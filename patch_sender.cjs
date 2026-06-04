const fs = require('fs');
const file = 'app/(dashboard)/contract-gateway/page.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Update setPrintData initialization
content = content.replace(/customRecipientDetails: meta\.customRecipientDetails \|\| \[/g, 
`customSenderDetails: meta.customSenderDetails || [
          settings?.companyName || 'NS AUTO SARL',
          settings?.address || 'Secteur 05, Parcelle C, Lot 1317 ter',
          settings?.rccm ? \`RCCM : \${settings.rccm}\` : 'RCCM : BF BBD 2018 B 0372',
          settings?.nif ? \`IFU : \${settings.nif}\` : 'IFU : 00102506 K',
          settings?.bp || 'BP 1245 Bobo-dioulasso',
          settings?.division || 'Division des Grandes Entreprises',
          settings?.taxSystem || 'Réel Normal d\\'Imposition'
        ].filter(Boolean).join('\\n'),
        customRecipientDetails: meta.customRecipientDetails || [`);

// 2. Add customSenderDetails to meta saves
content = content.replace(/customRecipientDetails: printData\.customRecipientDetails,/g,
`customSenderDetails: printData.customSenderDetails,
          customRecipientDetails: printData.customRecipientDetails,`);
content = content.replace(/customRecipientDetails: deliveryData\.customRecipientDetails,/g,
`customSenderDetails: deliveryData.customSenderDetails,
        customRecipientDetails: deliveryData.customRecipientDetails,`);

// 3. Update the Modals
const modalGridRegex = /<div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1\.5fr', gap: '0\.8rem', marginBottom: '0\.75rem' }}>\s*<div className="form-group">\s*<label className="form-label" style={{ marginBottom: '4px', fontSize: '0\.8rem' }}>Référence \/ Objet \(Zone Libre\)<\/label>[\s\S]*?<\/textarea>\s*<\/div>\s*<div className="form-group">\s*<label className="form-label" style={{ marginBottom: '4px', fontSize: '0\.8rem', color: 'var\(--primary\)', fontWeight: 'bold' }}>Détails du Destinataire \(Bloc de droite\)<\/label>/g;

const newModalGrid = `<div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Référence / Objet (Zone Libre)</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={printData.requestRef || ''}
                    onChange={e => setPrintData({ ...printData, requestRef: e.target.value })}
                    style={{ fontWeight: '600', padding: '6px 12px', resize: 'vertical' }}
                  ></textarea>
                </div>
                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>Détails de l'Expéditeur (Bloc de gauche)</label>
                  <textarea
                    className="form-control"
                    rows="5"
                    style={{ padding: '8px 12px', fontSize: '0.85rem', borderColor: 'var(--primary)', resize: 'vertical' }}
                    value={printData.customSenderDetails || ''}
                    onChange={e => setPrintData({ ...printData, customSenderDetails: e.target.value })}
                  ></textarea>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>Détails du Destinataire (Bloc de droite)</label>`;

content = content.replace(modalGridRegex, newModalGrid);

// 4. Update the Print table rendering for Bloc de gauche
const renderLeftBlockRegex = /<td style={{ width: '50%', verticalAlign: 'top', padding: '10px', borderRight: '1px solid #000' }}>\s*<p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{settings\?\.companyName \|\| 'NS AUTO SARL'} \/ Code client : {printData\?\.clientCode \|\| client\?\.client_code \|\| '-'}<\/p>[\s\S]*?<\/td>/g;

const newRenderLeftBlock = `<td style={{ width: '50%', verticalAlign: 'top', padding: '10px', borderRight: '1px solid #000' }}>
                  {printData.customSenderDetails ? (
                    <div style={{ fontSize: '10px', whiteSpace: 'pre-wrap', fontWeight: 'normal' }}>
                      <span style={{ fontWeight: 'bold' }}>{printData.customSenderDetails.split('\\n')[0]} / Code client : {printData?.clientCode || client?.client_code || '-'}</span>
                      {'\\n' + printData.customSenderDetails.split('\\n').slice(1).join('\\n')}
                    </div>
                  ) : (
                    <React.Fragment>
                      <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{settings?.companyName || 'NS AUTO SARL'} / Code client : {printData?.clientCode || client?.client_code || '-'}</p>
                      <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>{settings?.address || 'Secteur 05, Parcelle C, Lot 1317 ter'}</p>
                      <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>RCCM : {settings?.rccm || 'BF BBD 2018 B 0372'}</p>
                      <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>IFU : {settings?.nif || '00102506 K'}</p>
                      <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>{settings?.bp || 'BP 1245 Bobo-dioulasso'}</p>
                      <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>{settings?.division || 'Division des Grandes Entreprises'}</p>
                      <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>{settings?.taxSystem || 'Réel Normal d\\'Imposition'}</p>
                    </React.Fragment>
                  )}
                </td>`;

content = content.replace(renderLeftBlockRegex, newRenderLeftBlock);

fs.writeFileSync(file, content, 'utf8');
console.log('Patch complete.');
