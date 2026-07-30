import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';

// Configurações de diretório
const PDF_DIR = 'C:\\Users\\Luanm\\Downloads\\CAmeras ILUSTRRA\\Illustra DataSheets';
const OUTPUT_FILE = path.join(import.meta.dirname, '../frontend/src/data/cameras.json');

// Expressões regulares para extrair dados
const REGEX = {
  resolution: /([0-9]{3,4}\s*x\s*[0-9]{3,4})/i,
  fps: /([0-9]{2,3})\s*(?:fps|ips)/i,
  compression: /(H\.264|H\.265|MJPEG|MPEG-4)/gi,
  fov: /([0-9]{2,3})[°º]/i,
  range: /([0-9]{2,3})\s*m/i,
};

async function parseAllPDFs() {
  console.log(`Lendo PDFs no diretório: ${PDF_DIR}`);
  
  if (!fs.existsSync(PDF_DIR)) {
    console.error('Diretório não encontrado. Verifique o caminho da pasta.');
    return;
  }

  const files = fs.readdirSync(PDF_DIR).filter(file => file.toLowerCase().endsWith('.pdf'));
  console.log(`Encontrados ${files.length} arquivos PDF.`);

  const cameras = [];

  for (const file of files) {
    try {
      const filePath = path.join(PDF_DIR, file);
      const dataBuffer = fs.readFileSync(filePath);
      
      console.log(`Processando: ${file}...`);
      const data = await pdf(dataBuffer);
      const text = data.text;

      // Extract model name from filename and clean it up
      let modelName = file.replace(/\.pdf$/i, '')
                          .replace(/[-_]/g, ' ')
                          .replace(/\b(Data\s*Sheet|Datasheet|ds|hs|en|hr|cs|draft\d?|R\d+|v\d+|Specs)\b/gi, '')
                          .replace(/\s{2,}/g, ' ')
                          .trim();

      // Use regex to find attributes
      const resolutionMatch = text.match(REGEX.resolution);
      const fpsMatch = text.match(REGEX.fps);
      const compressionMatches = text.match(REGEX.compression);
      const fovMatch = text.match(REGEX.fov);
      const rangeMatch = text.match(REGEX.range);

      // Unique compression formats
      let compression = "H.264, H.265"; // Default if not found
      if (compressionMatches) {
        compression = [...new Set(compressionMatches)].join(', ');
      }

      cameras.push({
        model: modelName,
        resolution: resolutionMatch ? resolutionMatch[1].replace(/\s/g, '') : "1920x1080",
        fps: fpsMatch ? parseInt(fpsMatch[1], 10) : 30,
        compression: compression,
        fov: fovMatch ? parseInt(fovMatch[1], 10) : 90,
        range: rangeMatch ? parseInt(rangeMatch[1], 10) : 30
      });
      
    } catch (err) {
      console.error(`Erro ao processar ${file}:`, err.message);
    }
  }

  // Grava o arquivo final
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cameras, null, 2), 'utf8');
  console.log(`\nSucesso! ${cameras.length} câmeras foram processadas.`);
  console.log(`Dados salvos em: ${OUTPUT_FILE}`);
}

parseAllPDFs();
