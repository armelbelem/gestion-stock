import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Génère un identifiant unique lors du démarrage de l'instance du serveur.
// Cet identifiant changera à chaque nouveau déploiement / redémarrage du serveur.
const SERVER_BUILD_ID = uuidv4();

export async function GET() {
  return NextResponse.json({ buildId: SERVER_BUILD_ID });
}
