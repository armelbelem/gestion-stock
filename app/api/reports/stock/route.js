import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken, hasPermission } from '../../../lib/auth';
import { getStoreConstraint } from '../../../lib/actions';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  
  if (!hasPermission(auth.user, 'stock', 'view')) {
    return NextResponse.json({ error: 'Accès interdit : Permissions insuffisantes' }, { status: 403 });
  }

    // Récupérer l'exercice actif
    const [fyRows] = await db.query("SELECT * FROM fiscal_years WHERE status = 'active'");
    const activeYear = fyRows[0];
    if (!activeYear) {
      // Retourner une liste vide au lieu d'une erreur
      return NextResponse.json([]);
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || activeYear.startDate.toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const storeId = getStoreConstraint(auth.user, searchParams.get('storeId'));

  try {
    // 1. Récupérer les infos des articles pour la base
    const [articles] = await db.query('SELECT id, name, code, price FROM articles');
    const articlesMap = {};
    articles.forEach(a => { articlesMap[a.id] = a; });

    // 2. Récupérer le stock ACTUEL (somme par article)
    const [currentInventory] = await db.query(`
      SELECT articleId, SUM(quantity) as quantity 
      FROM inventory 
      ${storeId ? 'WHERE storeId = ?' : ''}
      GROUP BY articleId
    `, storeId ? [storeId] : []);

    // 3. Récupérer TOUS les mouvements depuis le début de la période jusqu'à MAINTENANT
    const [movements] = await db.query(`
      SELECT articleId, type, quantity, date 
      FROM mouvements 
      WHERE date >= ?
      ${storeId ? 'AND storeId = ?' : ''}
    `, storeId ? [startDate, storeId] : [startDate]);

    const report = {};

    // Initialiser le rapport avec les articles qui ont du stock ou des mouvements
    articles.forEach(art => {
      report[art.id] = { 
        ...art, 
        initial: 0, 
        entries: 0, 
        exits: 0, 
        final: 0, 
        current: 0 
      };
    });

    // Appliquer le stock actuel
    currentInventory.forEach(inv => {
      if (report[inv.articleId]) {
        report[inv.articleId].current = Number(inv.quantity);
      }
    });

    // Traiter les mouvements
    movements.forEach(mov => {
      const artId = mov.articleId;
      if (!report[artId]) return;

      const type = (mov.type || '').toUpperCase().trim();
      const qty = Number(mov.quantity);
      
      // Déterminer si c'est une entrée ou une sortie
      const isEntry = ['IN', 'ENTRÉE', 'ENTREE', 'ACHAT', 'TRANSFERT IN'].includes(type);
      const isExit = ['OUT', 'SORTIE', 'VENTE', 'TRANSFERT OUT', 'ANNULÉE', 'ANNULEE'].includes(type);
      
      const movDate = mov.date.substring(0, 10);
      const isDuringPeriod = movDate >= startDate && movDate <= endDate;
      
      // On calcule le changement total depuis StartDate pour remonter au stock initial
      const change = isEntry ? qty : (isExit ? -qty : 0);
      report[artId].totalChangeSinceStart = (report[artId].totalChangeSinceStart || 0) + change;

      if (isDuringPeriod) {
        if (isEntry) report[artId].entries += qty;
        else if (isExit) report[artId].exits += qty;
      }
    });

    // Calculs finaux
    const finalReport = Object.values(report).map(art => {
      // Stock Initial = Stock Actuel - Changements depuis le début
      art.initial = art.current - (art.totalChangeSinceStart || 0);
      // Stock Final = Stock au début + entrées période - sorties période
      art.final = art.initial + art.entries - art.exits;
      
      return art;
    }).filter(art => 
      art.initial !== 0 || art.entries !== 0 || art.exits !== 0 || art.current !== 0
    ).sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(finalReport);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
