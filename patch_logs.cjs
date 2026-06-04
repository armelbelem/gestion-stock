const fs = require('fs');
const file = 'app/api/contract-orders/[id]/route.js';
let content = fs.readFileSync(file, 'utf8');

// Ensure logAction is imported
if (!content.includes('logAction')) {
  content = content.replace(/import \{ authenticateToken, isAdmin, hasPermission \} from '\.\.\/\.\.\/\.\.\/lib\/auth';/, 
  `import { authenticateToken, isAdmin, hasPermission } from '../../../lib/auth';\nimport { logAction } from '../../../lib/actions';`);
}

// Add logAction to PUT
if (!content.includes('Modification dossier contrat')) {
  content = content.replace(/await connection\.commit\(\);\n\n    return NextResponse\.json\(\{ success: true \}\);/,
  `await connection.commit();
    await logAction(auth.user.id, auth.user.storeId, 'Modification dossier contrat', { orderId: id, status });
    return NextResponse.json({ success: true });`);
}

// Add logAction to DELETE
if (!content.includes('Suppression dossier contrat')) {
  // We need to replace the second match for DELETE or do a global replace carefully
  const parts = content.split('await connection.commit();\n\n    return NextResponse.json({ success: true });');
  if (parts.length > 2) {
      content = parts[0] + 
                "await connection.commit();\n    await logAction(auth.user.id, auth.user.storeId, 'Modification dossier contrat', { orderId: id, status });\n    return NextResponse.json({ success: true });" + 
                parts[1] + 
                "await connection.commit();\n    await logAction(auth.user.id, auth.user.storeId, 'Suppression dossier contrat', { orderId: id });\n    return NextResponse.json({ success: true });" + 
                parts[2];
  }
}

fs.writeFileSync(file, content, 'utf8');
console.log('Patch complete.');
