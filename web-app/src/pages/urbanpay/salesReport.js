// Sales list helpers and the printable sales report. Pure apart from printSalesReport().
import { formatAud, formatDateAU, formatDateTimeAU } from '@/lib/format';
import { escapeHtml } from '@/lib/escape';
import { SALES_REPORT_CSS } from './salesReportStyles';

// Firestore Timestamp, Date or string -> Date (null if missing or unparseable).
export function saleDate(sale) {
    const value = sale.createdAt;
    if (!value) return null;
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

// Newest first; sales without a date go last.
export function sortSalesNewestFirst(sales) {
    return [...sales].sort((a, b) => (saleDate(b)?.getTime() ?? -Infinity) - (saleDate(a)?.getTime() ?? -Infinity));
}

export function salesTotal(sales) {
    return sales.reduce((sum, sale) => sum + (Number(sale.amount) || 0), 0);
}

export function paymentLabel(sale) {
    return sale.paymentMethod === 'cash' ? '💵 Cash' : '💳 Card';
}

function reportRow(sale) {
    const badgeClass = sale.paymentMethod === 'cash' ? 'type-cash' : 'type-card';
    return `
        <tr>
            <td class="date-cell">${formatDateTimeAU(saleDate(sale), 'Unknown date')}</td>
            <td><span class="type-badge ${badgeClass}">${paymentLabel(sale)}</span></td>
            <td>${escapeHtml(sale.description || '—')}</td>
            <td class="amount-cell">${formatAud(sale.amount)}</td>
        </tr>`;
}

// Full HTML document for the printable report. Descriptions are user-supplied and escaped.
export function buildSalesReportHtml(sales, generatedAt = new Date()) {
    const total = formatAud(salesTotal(sales));
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Urban Garage Sale - Sales Report</title>
            <style>${SALES_REPORT_CSS}</style>
        </head>
        <body>
            <div class="content">
                <div class="header">
                    <div class="ribbon">
                        <div class="ribbon-text">
                            <h1>Urban Garage Sale</h1>
                            <p>Sales Performance Report</p>
                        </div>
                    </div>
                </div>

                <div class="report-meta">
                    <div class="report-meta-grid">
                        <div class="meta-item">
                            <div class="meta-label">Generated</div>
                            <div class="meta-value">${formatDateAU(generatedAt)}</div>
                        </div>
                        <div class="meta-item">
                            <div class="meta-label">Total Transactions</div>
                            <div class="meta-value">${sales.length}</div>
                        </div>
                        <div class="meta-item">
                            <div class="meta-label">Period Revenue</div>
                            <div class="meta-value">${total}</div>
                        </div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>Payment Type</th>
                            <th>Item Description</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>${sales.map(reportRow).join('')}
                    </tbody>
                </table>

                <div class="grand-total">
                    <div class="grand-total-label">💰 Grand Total Revenue</div>
                    <div class="grand-total-value">${total}</div>
                </div>

                <div class="footer">
                    <div class="footer-text">Urban Garage Sale Platform © ${generatedAt.getFullYear()} — Your Local Garage Sale Hub</div>
                    <div class="footer-text">Find & List Garage Sales Locally | This report is confidential and for your records only</div>
                </div>
            </div>
        </body>
        </html>`;
}

// Opens the report in a new window and prints it. Returns false if the popup was blocked.
export function printSalesReport(sales) {
    const printWindow = window.open('', '', 'width=1000,height=600');
    if (!printWindow) return false;
    printWindow.document.write(buildSalesReportHtml(sales));
    printWindow.document.close();
    // Wait for the document to render before printing
    setTimeout(() => printWindow.print(), 250);
    return true;
}
