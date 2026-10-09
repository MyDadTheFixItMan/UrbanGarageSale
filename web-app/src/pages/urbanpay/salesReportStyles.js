// Styles for the printable Urban Pay sales report.
export const SALES_REPORT_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: #f8fafc !important;
    color: #1e293b;
    line-height: 1.6;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}

@page {
    margin: 0.5in;
    size: letter;
    background: #f8fafc !important;
}

.content {
    position: relative;
    z-index: 10;
    padding: 20px;
}

.header {
    background: white !important;
    padding: 5px 40px 0 40px;
    margin-bottom: 35px;
    text-align: center;
    page-break-inside: avoid;
}

.header img {
    display: none;
}

.ribbon {
    background: linear-gradient(to right, #f97316 0%, #fb923c 100%) !important;
    color: white !important;
    padding: 12px 40px;
    margin: 0 -40px -35px -40px;
    border-radius: 0;
    text-align: center;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}

.ribbon img {
    display: none;
}

.ribbon-text {
    display: block;
}

.ribbon h1 {
    font-size: 28px;
    margin: 0 0 4px 0;
    font-weight: 800;
    letter-spacing: 0.5px;
    color: white !important;
}

.ribbon p {
    opacity: 1;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.3px;
    margin: 0;
    color: white !important;
}

.logo-badge {
    display: none;
}

.report-meta {
    background: white !important;
    padding: 30px;
    border-left: 6px solid #f97316 !important;
    margin-bottom: 35px;
    border-radius: 10px;
    page-break-inside: avoid;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}

.report-meta-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 30px;
}

.meta-item {
    text-align: center;
    padding: 15px 0;
    border-right: 1px solid #e2e8f0;
}

.meta-item:last-child {
    border-right: none;
}

.meta-label {
    color: #64748b !important;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 12px;
}

.meta-value {
    font-size: 26px;
    font-weight: 900;
    color: white !important;
    background: linear-gradient(135deg, #1e3a5f 0%, #2d5a8c 100%) !important;
    padding: 12px 16px;
    border-radius: 6px;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}

.section-title {
    font-size: 17px;
    color: white !important;
    background: linear-gradient(to right, #1e3a5f 0%, #2d5a8c 100%) !important;
    padding: 16px 24px;
    margin: 35px 0 20px 0;
    border-radius: 8px;
    font-weight: 800;
    letter-spacing: 0.3px;
    page-break-inside: avoid;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 28px;
    border-radius: 8px;
    overflow: hidden;
    page-break-inside: avoid;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}

th {
    background: #1e3a5f !important;
    color: white !important;
    padding: 16px 14px;
    text-align: left;
    font-weight: 800;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    border: none;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}

td {
    padding: 14px;
    border-bottom: 1px solid #e2e8f0 !important;
    background: white !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}

tr:nth-child(even) td {
    background-color: #f8fafc !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}

.subtotal-row td {
    background: linear-gradient(to right, #e0f2fe 0%, #f0f9ff 100%) !important;
    font-weight: 800;
    color: #1e3a5f !important;
    border-top: 3px solid #0284c7 !important;
    border-bottom: 3px solid #0284c7 !important;
    padding: 16px 14px;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}

.amount-cell {
    text-align: right;
    font-weight: 700;
    color: #1e3a5f !important;
    font-family: 'Courier New', monospace;
    font-size: 15px;
}

.date-cell {
    color: #64748b !important;
    font-size: 13px;
    font-weight: 500;
}

.type-badge {
    display: inline-block;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 800;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}

.type-cash {
    background: #dcfce7 !important;
    color: #15803d !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}

.type-card {
    background: #cffafe !important;
    color: #0369a1 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}

.grand-total {
    margin-top: 45px;
    padding: 20px;
    background: linear-gradient(135deg, #f97316 0%, #fb923c 100%) !important;
    color: white !important;
    border-radius: 12px;
    text-align: center;
    page-break-inside: avoid;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}

.grand-total-label {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    margin-bottom: 8px;
    color: white !important;
}

.grand-total-value {
    font-size: 56px;
    font-weight: 900;
    font-family: 'Courier New', monospace;
    letter-spacing: 3px;
    color: white !important;
}

.footer {
    margin-top: 45px;
    padding-top: 25px;
    border-top: 3px solid #f97316 !important;
    text-align: center;
    color: #64748b !important;
    font-size: 11px;
    page-break-inside: avoid;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}

.footer-text {
    margin: 6px 0;
    font-weight: 600;
    color: #64748b !important;
}

@media print {
    html, body { 
        background: #f8fafc !important;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    * { 
        box-shadow: none !important;
        page-break-inside: avoid !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
}
`;
