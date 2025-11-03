import jsPDF from 'jspdf';
// --- INICIO DE LA MODIFICACIÓN: Importar 'autoTable' como una función nombrada ---
import autoTable from 'jspdf-autotable';
// --- FIN DE LA MODIFICACIÓN ---

/**
 * Genera un PDF para un pedido.
 * @param {object} pedido - El objeto del pedido completo, incluyendo cliente y items.
 * @param {object} options - Opciones como { action: 'download' | 'share' | 'blob' }
 * @returns {Promise<void|Blob>} - No devuelve nada si descarga/comparte, o un Blob si se especifica.
 */
export const generatePedidoPDF = async (pedido, options = { action: 'download' }) => {
    if (!pedido) {
        console.error("Se necesita un objeto de pedido para generar el PDF.");
        return;
    }

    const doc = new jsPDF();
    const cliente = pedido.cliente_nombre_snapshot || 'Cliente no especificado';
    const vendedor = pedido.nombre_vendedor || 'Vendedor no especificado';
    const fecha = new Date(pedido.fecha || pedido.fecha_creacion).toLocaleDateString('es-AR');
    const pedidoId = pedido.id || pedido.local_id;

    // --- Cabecera del Documento ---
    doc.setFontSize(20);
    doc.text("Resumen de Pedido", 14, 22);
    doc.setFontSize(12);
    doc.text(`Pedido #: ${pedidoId}`, 14, 30);
    doc.text(`Fecha: ${fecha}`, 14, 36);

    doc.setFontSize(10);
    doc.text(`Cliente: ${cliente}`, 196, 22, { align: 'right' });
    doc.text(`Vendedor: ${vendedor}`, 196, 28, { align: 'right' });

    // --- Tabla de Items ---
    const tableColumn = ["SKU", "Producto", "Cant.", "Precio Unit.", "Subtotal"];
    const tableRows = [];
    let totalGeneral = 0;

    (pedido.items || []).forEach(item => {
        const precioUnitario = item.precio_congelado || item.producto?.precio_unitario || 0;
        const cantidad = item.cantidad || 0;
        const subtotal = precioUnitario * cantidad;
        totalGeneral += subtotal;

        const itemData = [
            item.codigo_sku || item.producto?.codigo_sku || 'N/A',
            item.nombre_producto || item.producto?.nombre || 'Producto no encontrado',
            cantidad,
            `$${precioUnitario.toFixed(2)}`,
            `$${subtotal.toFixed(2)}`
        ];
        tableRows.push(itemData);
    });

    // --- INICIO DE LA MODIFICACIÓN: Usar la nueva sintaxis de autoTable ---
    let finalY = 0;
    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        theme: 'striped',
        headStyles: { fillColor: [22, 160, 133] }, // Un color verde azulado
        didDrawPage: (data) => {
            finalY = data.cursor.y; // Guardamos la posición Y final de la tabla
        }
    });
    // --- FIN DE LA MODIFICACIÓN ---

    // --- Totales y Notas ---
    doc.setFontSize(14);
    doc.text(`Total del Pedido: $${totalGeneral.toFixed(2)}`, 14, finalY + 15);

    if (pedido.notas_entrega) {
        doc.setFontSize(12);
        doc.text("Notas para la entrega:", 14, finalY + 25);
        const splitNotes = doc.splitTextToSize(pedido.notas_entrega, 180);
        doc.text(splitNotes, 14, finalY + 31);
    }
    
    // --- Lógica de Acción ---
    const fileName = `Pedido_${pedidoId}_${cliente.replace(/\s/g, '_')}.pdf`;

    if (options.action === 'download') {
        doc.save(fileName);
    } else if (options.action === 'share' && navigator.share) {
        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
        try {
            await navigator.share({
                title: `Pedido ${pedidoId}`,
                text: `Adjunto el resumen del pedido para ${cliente}.`,
                files: [pdfFile],
            });
        } catch (error) {
            console.error('Error al compartir el PDF:', error);
            // Si falla el share (ej. en escritorio), lo descargamos como fallback.
            doc.save(fileName);
        }
    } else if (options.action === 'blob') {
        return doc.output('blob');
    } else {
        // Fallback por defecto es descargar
        doc.save(fileName);
    }
};