const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const PDFDocument = require('pdfkit');
const { formidable } = require('formidable');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const getValue = (val) => (val && val.trim ? val.trim() : 'Néant');

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/upload-pdf', (req, res) => {
  const form = formidable({ multiples: false, keepExtensions: true, uploadDir: path.join(__dirname, 'uploads') });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).send("Erreur lors de l'analyse du fichier PDF.");

    const pdfFile = files.pdfFile?.[0] || files.pdfFile;
    if (!pdfFile || !pdfFile.filepath) return res.status(400).send("Fichier PDF non reçu.");

    const dataBuffer = fs.readFileSync(pdfFile.filepath);
    const pdfText = (await pdfParse(dataBuffer)).text;

    const extract = (label) => {
      const regex = new RegExp(label.replace(/\s+/g, '\\s*') + '\\s*([^\\n]*)', 'i');
      const match = pdfText.match(regex);
      return match ? match[1].trim() : '';
    };

    const comptesRegex = /Nature des comptes compatibles\s*([\s\S]*?)(?:\n\s*\w.*?:|\n\s*Direction|\n\s*Chargé|$)/i;
    const comptesMatch = pdfText.match(comptesRegex);
    let comptesCompatibles = [];

    if (comptesMatch && comptesMatch[1]) {
      const matchedCodes = comptesMatch[1].match(/[A-Z]{4}\d{2}/g);
      comptesCompatibles = matchedCodes ? [...matchedCodes] : [];
      if (comptesMatch[1].includes('Néant')) {
        comptesCompatibles.unshift('Néant');
      }
    }

    const normalizeYesNo = (val) => {
      const v = val?.trim().toLowerCase();
      return v === 'oui' ? 'Oui' : v === 'non' ? 'Non' : '';
    };

    const normalizeSigne = (val) => {
      const v = val?.trim().toLowerCase();
      return v.includes('crédit') ? 'credit' : v.includes('débit') ? 'debit' : '';
    };

    const data = {
      code: extract("Code d'opération"),
      libelle: extract("Libellé de l'opération"),
      nature: extract("Nature de type opération"),
      effet: extract("Effet d'opération"),
      descriptif: extract("Descriptif de l'opération"),
      signe: normalizeSigne(extract("Signe de l'opération")),
      destination: extract("Destination de l'opération"),
      type_impact: extract("Type d'impact"),
      debit_credit_immediat: normalizeYesNo(extract("Débit/Crédit immédiat")),
      autoriser_paiement_partiel: normalizeYesNo(extract("Autoriser le paiement partiel")),
      type_annulation: extract("Type opération d'annulation"),
      type_rejet: extract("Type opération de rejet"),
      type_interne_recue: extract("Type opération interne reçue"),
      devise: extract("Devise"),
      application_tva: normalizeYesNo(extract("Application TVA")),
      activation_compte: normalizeYesNo(extract("Opération qui active le compte")),
      reserve_blocage: normalizeYesNo(extract("Réserve opération de blocage")),
      operation_force: normalizeYesNo(extract("Opération soumise au forçage")),
      validation_processus: normalizeYesNo(extract("Opération soumise à un processus de validation")),
      dereserve_agios: normalizeYesNo(extract("Déréservé AGIOS")),
      regle_conversion: normalizeYesNo(extract("Règle de conversion")),
      envoi_sdm: normalizeYesNo(extract("Envoi à la SDM en fin de journée")),
      comptes_compatibles: comptesCompatibles,
      direction: extract("Direction concernée"),
      charge: extract("Chargé")
    };

    res.render('formulaire', { data });
  });
});

app.post('/submit', (req, res) => {
  const data = req.body;
  const PDFDocument = require('pdfkit');
  const fs = require('fs');
  const path = require('path');

  const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 30, bottom: 50, left: 50, right: 50 },
  bufferPages: true
});


  const sanitizeFilename = (name) =>
    name.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 \-_]/g, "")
      .trim().replace(/\s+/g, "_");

  const codeClean = sanitizeFilename(data.code || "Code");
  const libelleClean = sanitizeFilename(data.libelle || "Operation");
  const pdfFilename = `${codeClean}_${libelleClean}.pdf`;

  const exportDir = path.join(__dirname, 'exports');
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);
  const pdfPath = path.join(exportDir, pdfFilename);
  const logoPath = path.join(__dirname, 'public/images/logo.png');

  doc.pipe(fs.createWriteStream(pdfPath));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename}"`);
  doc.pipe(res);

  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR');
  const timeStr = now.toLocaleTimeString('fr-FR');

  const marginX = 60;
  const col1Width = 200;
  const col2Width = 280;

  const champs = [
    ["Code de l'opération", data.code],
    ["Libellé de l'opération", data.libelle],
    ["Nature de type opération", data.nature],
    ["Effet d'opération", data.effet],
    ["Descriptif de l'opération", data.descriptif],
    ["Signe de l'opération", data.signe],
    ["Destination de l'opération", data.destination],
    ["Type d'impact", data.type_impact],
    ["Débit/Crédit immédiat", data.debit_credit_immediat],
    ["Autoriser le paiement partiel", data.autoriser_paiement_partiel],
    ["Type opération d'annulation", data.type_annulation],
    ["Type opération de rejet", data.type_rejet],
    ["Type opération interne reçue", data.type_interne_recue],
    ["Devise", data.devise],
    ["Application TVA", data.application_tva],
    ["Opération qui active le compte", data.activation_compte],
    ["Réserve opération de blocage", data.reserve_blocage],
    ["Opération soumise au forçage", data.operation_force],
    ["Validation processus", data.validation_processus],
    ["Déréservé AGIOS", data.dereserve_agios],
    ["Règle de conversion", data.regle_conversion],
    ["Envoi à la SDM", data.envoi_sdm],
    ["Comptes compatibles", Array.isArray(data.comptes_compatibles) ? data.comptes_compatibles.join('\n') : data.comptes_compatibles],
    ["Direction concernée", data.direction],
    ["Chargé", data.charge]
  ];

  const getValue = (val) => (val && val.trim ? val.trim() : 'Néant');

  function renderHeader() {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');

    // Texte à gauche
    const leftText = "Direction Organisation & Référentiels";
    const leftX = 50;
    const yText = 30;
    doc.text(leftText, leftX, yText);

    // Texte à droite
    const rightText = `Fiche générée le ${dateStr} à ${timeStr}`;
    const rightX = doc.page.width - doc.widthOfString(rightText) - 50;
    doc.text(rightText, rightX, yText);

    // Calculs pour centrer le titre entre les deux textes
    const leftTextWidth = doc.widthOfString(leftText);
    const rightTextWidth = doc.widthOfString(rightText);
    const spaceBetween = rightX - (leftX + leftTextWidth);

    const titleText = "Fiche Opération Financière";
    const titleWidth = doc.widthOfString(titleText);
    const titleX = leftX + leftTextWidth + (spaceBetween / 2) - (titleWidth / 2) - 30;


    // Logo centré sous la ligne de texte
    if (fs.existsSync(logoPath)) {
      const logoWidth = 80;
      const logoX = (doc.page.width - logoWidth) / 2;
      const logoY = yText + 20;
      doc.image(logoPath, logoX, logoY, { width: logoWidth });
    }

    // Titre centré précisément
    const titleY = yText + 70;
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000');
    doc.text(titleText, titleX, titleY);

    // En-tête du tableau
    const tableHeaderY = titleY + 40;
    doc.fontSize(11).font('Helvetica-Bold');
    doc.fillColor('#dbeafe').rect(marginX, tableHeaderY, col1Width + col2Width, 24).fill();
    doc.fillColor('#000');
    doc.text("Libellé", marginX + 8, tableHeaderY + 6, { width: col1Width });
    doc.text("Valeur", marginX + col1Width + 8, tableHeaderY + 6, { width: col2Width });

    return tableHeaderY + 24;
  }

  let currentY = renderHeader();

  champs.forEach(([label, val], index) => {
  const valStr = getValue(val);
  const bgColor = index % 2 === 0 ? '#f8fafc' : '#ffffff';

  // Couleur selon la valeur
  let textColor = '#2e7d32'; // vert par défaut
  if (valStr.toLowerCase() === 'néant') {
    textColor = 'red';
  }
  if (label === 'Direction concernée' || label === 'Chargé') {
    textColor = '#000'; // noir forcé
  }

  const height1 = doc.heightOfString(label, { width: col1Width - 10 });
  const height2 = doc.heightOfString(valStr, { width: col2Width - 10 });
  const rowHeight = Math.max(height1, height2) + 12;

  if (currentY + rowHeight > doc.page.height - 60) {
    doc.addPage();
    currentY = renderHeader();
  }

  doc.fillColor(bgColor).rect(marginX, currentY, col1Width + col2Width, rowHeight).fill();
  doc.strokeColor('#d1d5db').lineWidth(0.5).rect(marginX, currentY, col1Width + col2Width, rowHeight).stroke();

  doc.fillColor('#000').font('Helvetica-Bold');
  doc.text(label, marginX + 8, currentY + 6, { width: col1Width - 10 });

  if (label === 'Direction concernée' || label === 'Chargé') {
  doc.font('Helvetica-Bold');
} else {
  doc.font('Helvetica');
}
doc.fillColor(textColor);
doc.text(valStr, marginX + col1Width + 8, currentY + 6, { width: col2Width - 10 });


  currentY += rowHeight;
});


 

 // Ajouter la signature uniquement si "validation_processus" est "Oui"
if (data.validation_processus?.toLowerCase() === 'oui') {
  const signaturePath = path.join(__dirname, 'public/images/signature.png');

  if (currentY + 100 > doc.page.height - 60) {
    doc.addPage();
    currentY = renderHeader();
  }

  doc.moveDown(2);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#000');
  doc.text("Validée par la Direction :", marginX, currentY + 40);

  if (fs.existsSync(signaturePath)) {
    doc.image(signaturePath, marginX + 180, currentY + 30, { width: 150 });
  } else {
    doc.moveTo(marginX + 180, currentY + 55)
       .lineTo(marginX + 380, currentY + 55)
       .stroke();
  }
}
const pageCount = doc.bufferedPageRange().count;

for (let i = 0; i < pageCount; i++) {
  doc.switchToPage(i);
  const pageText = `Page ${i + 1} sur ${pageCount}`;
  const textWidth = doc.widthOfString(pageText);
  const centerX = (doc.page.width - textWidth) / 2;

  const bottomY = doc.page.height - doc.page.margins.bottom + 20; // 20 = légèrement au-dessus du bas

  doc.font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#666')
    .text(pageText, centerX, bottomY, { lineBreak: false });
}


  doc.end();
});



app.listen(port, () => {
  console.log(`✅ Serveur en cours sur http://localhost:${port}`);
});
