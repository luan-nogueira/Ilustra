import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { SceneObject } from '../store/useProjectStore';

export const exportProjectToPDF = async (
  elementId: string, 
  projectName: string, 
  sceneObjects: SceneObject[], 
  walls: any[]
) => {
  try {
    const el = document.getElementById(elementId);
    if (!el) {
      alert("Elemento não encontrado para exportar.");
      return;
    }

    // Capture the screen
    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/jpeg', 0.85);

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Title
    pdf.setFillColor(15, 23, 42); // Slate 900
    pdf.rect(0, 0, pdfWidth, 20, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.text(`Proposta de Segurança: ${projectName}`, 10, 13);
    
    // Add captured image
    const imgRatio = canvas.height / canvas.width;
    const renderHeight = pdfWidth * imgRatio;
    
    pdf.addImage(imgData, 'JPEG', 0, 25, pdfWidth, renderHeight);

    // New page for equipment list
    pdf.addPage();
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, pdfWidth, 20, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.text(`Lista de Equipamentos`, 10, 13);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);

    let yPos = 35;
    const cameras = sceneObjects.filter(o => o.type === 'camera');
    pdf.text(`Total de Câmeras: ${cameras.length}`, 10, yPos);
    yPos += 10;
    
    cameras.forEach((cam, i) => {
      pdf.text(`${i + 1}. Modelo: ${cam.model || 'Genérico'} | Lente: ${cam.focalLength ?? 2.8}mm | Alcance: ${cam.range}m | FOV: ${cam.fov}°`, 10, yPos);
      yPos += 8;
      if (yPos > pdfHeight - 20) {
        pdf.addPage();
        yPos = 20;
      }
    });

    // Save
    pdf.save(`Proposta_${projectName.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert("Ocorreu um erro ao gerar o PDF da proposta.");
  }
};
