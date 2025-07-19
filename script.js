let db;
let clickCount = 0;
const maxServices = 14;
let currentServiceNumber = 0; // Número do serviço gerado, global

// Converte Uint8Array para string em blocos para evitar erro no apply()
function uint8ToString(u8Array) {
  const CHUNK_SIZE = 0x8000; // 32768
  let result = '';
  for (let i = 0; i < u8Array.length; i += CHUNK_SIZE) {
    const chunk = u8Array.subarray(i, i + CHUNK_SIZE);
    result += String.fromCharCode.apply(null, chunk);
  }
  return result;
}

// Salva o banco SQLite no localStorage em Base64 (sem erro)
function saveDatabaseToLocalStorage() {
  const data = db.export(); // Uint8Array
  const binaryString = uint8ToString(data);
  const base64 = btoa(binaryString);
  localStorage.setItem('myDatabase', base64);
}

// Inicializa o banco SQLite, carregando do localStorage se existir
async function initDatabase() {
  const SQL = await initSqlJs({
    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/${file}`
  });

  const savedDb = localStorage.getItem('myDatabase');
  if (savedDb) {
    const binaryString = atob(savedDb);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    db = new SQL.Database(bytes);
  } else {
    db = new SQL.Database();
    db.run(`CREATE TABLE IF NOT EXISTS pdfs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      data TEXT,
      conteudo TEXT
    )`);
    saveDatabaseToLocalStorage();
  }
}

// Salva um PDF no banco e atualiza localStorage
function savePdfToDatabase(nome, data, base64Content) {
  const stmt = db.prepare("INSERT INTO pdfs (nome, data, conteudo) VALUES (?, ?, ?)");
  stmt.run([nome, data, base64Content]);
  stmt.free();
  saveDatabaseToLocalStorage();
}

// Lista PDFs salvos na div #download-list (usar só em downloads.html)
function listarPdfsSalvos() {
  const result = db.exec("SELECT id, nome, data, conteudo FROM pdfs ORDER BY id DESC");
  const downloadList = document.getElementById('download-list');
  if (!downloadList) return; // segurança caso não exista essa div
  downloadList.innerHTML = '';
  if (result.length === 0) {
    downloadList.innerHTML = '<p>Nenhum PDF salvo.</p>';
    return;
  }
  const rows = result[0].values;
  rows.forEach(([id, nome, data, conteudo]) => {
    const link = document.createElement('a');
    link.href = conteudo;
    link.download = nome;
    link.textContent = `${nome} - ${data}`;
    link.style.display = 'block';
    downloadList.appendChild(link);
  });
}

// Formata data yyyy-mm-dd para dd/mm/yyyy
function formatDateToBrazilian(date) {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

// Adiciona conteúdo no PDF
function addContent(doc, yOffset) {
  const pageWidth = doc.internal.pageSize.width;

  // Título
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("AUTORIZAÇÃO DE SERVIÇO", pageWidth / 2, yOffset - 10, { align: 'center' });

  // Número serviço em vermelho
  doc.setTextColor(255, 0, 0);
  doc.setFontSize(10);
  doc.text(`Número: ${currentServiceNumber}`, pageWidth / 2, yOffset - 5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Dados da empresa
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text('RJ PNEUS', 10, yOffset + 1);
  doc.setFontSize(9);
  doc.text('RENOVAÇÃO, CONSERTOS EM GERAL', 10, yOffset + 5);
  doc.text('Rua C2 - Bairro Boa Vista, Qd. 16 Lt. 52 e 53 - Luís Eduardo Magalhães - BA', 10, yOffset + 10);
  doc.text('Fone: (77) 9 9924-1468', 10, yOffset + 15);
  doc.text(`CNPJ: 36.881.820/0001-87`, 10, yOffset + 20);

  // Dados do cliente
  const cliente = document.getElementById('cliente')?.value || '';
  const telefone = document.getElementById('telefone')?.value || '';
  const endereco = document.getElementById('endereco')?.value || '';
  const placa = document.getElementById('placa')?.value || '';
  const numero = document.getElementById('numero')?.value || '';
  const cnpj = document.getElementById('cnpj')?.value || '';
  const inscricaoEstadual = document.getElementById('inscricao-estadual')?.value || '';
  const dataRaw = document.getElementById('data')?.value || new Date().toISOString().slice(0, 10);
  const formattedDate = formatDateToBrazilian(dataRaw);
  const municipio = document.getElementById('municipio')?.value || '';

  doc.setFontSize(9);
  doc.text(`Sr: ${cliente}`, pageWidth / 20, yOffset + 25);
  doc.text(`Placa: ${placa}`, pageWidth - 140, yOffset + 25);
  doc.text(`Telefone: ${telefone}`, pageWidth - 140, yOffset + 30);
  doc.text(`CNPJ: ${cnpj}`, pageWidth / 20, yOffset + 30);
  doc.text(`Endereço: ${endereco}`, pageWidth - 140, yOffset + 35);
  doc.text(`Inscrição Estadual: ${inscricaoEstadual}`, pageWidth - 80, yOffset + 25);
  doc.text(`Número: ${numero}`, pageWidth / 20, yOffset + 35);
  doc.text(`Data: ${formattedDate}`, pageWidth - 80, yOffset + 30);
  doc.text(`Município: ${municipio}`, pageWidth - 80, yOffset + 35);

  // Cabeçalho da tabela
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text('Medidas', 10, yOffset + 40);
  doc.text('Marca', 30, yOffset + 40);
  doc.text('Série', 55, yOffset + 40);
  doc.text('Lonas', 65, yOffset + 40);
  doc.text('Discriminação', 80, yOffset + 40);
  doc.text('Desenho', 110, yOffset + 40);
  doc.text('Unitário', 130, yOffset + 40);
  doc.text('Desconto', 150, yOffset + 40);
  doc.text('Total', 180, yOffset + 40);

  // Linha separadora da tabela
  doc.line(7, yOffset + 36, pageWidth - 7, yOffset + 36);

  const items = document.querySelectorAll('.service-item');
  let yOffsetItems = yOffset + 45;
  let rowCounter = 0;
  let totalGeral = 0;

  items.forEach(item => {
    const medidas = item.querySelector('.medidas')?.value || '';
    const marca = item.querySelector('.marca')?.value || '';
    const serie = item.querySelector('.serie')?.value || '';
    const lonas = parseFloat(item.querySelector('.lonas')?.value) || 0;
    const discriminacao = item.querySelector('.discriminacao')?.value || '';
    const desenho = item.querySelector('.desenho')?.value || '';
    const unitario = parseFloat(item.querySelector('.unitario')?.value) || 0;
    const desconto = parseFloat(item.querySelector('.desconto')?.value) || 0;

    const totalComDesconto = lonas * unitario - desconto;
    totalGeral += totalComDesconto;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(medidas.toString(), 10, yOffsetItems);
    doc.text(marca, 30, yOffsetItems);
    doc.text(serie.toString(), 55, yOffsetItems);
    doc.text(lonas.toString(), 65, yOffsetItems);
    doc.text(discriminacao, 80, yOffsetItems);
    doc.text(desenho, 110, yOffsetItems);
    doc.text(`R$ ${unitario.toFixed(2)}`, 130, yOffsetItems);
    doc.text(`R$ ${desconto.toFixed(2)}`, 150, yOffsetItems);
    doc.text(`R$ ${totalComDesconto.toFixed(2)}`, 180, yOffsetItems);

    yOffsetItems += 5;
    rowCounter++;

    if (rowCounter >= 20) {
      doc.addPage();
      yOffsetItems = 20;
      rowCounter = 0;
    }
  });

  // Total geral no final
  yOffsetItems += 5;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Geral: R$ ${totalGeral.toFixed(2)}`, pageWidth - 60, yOffsetItems);

  // Examinador e Assinatura
  doc.setFontSize(8);
  doc.text('Examinador:', 10, yOffsetItems + 5);
  doc.text('Assinatura:', 60, yOffsetItems + 5);

  // Rodapé com data e hora
  const currentDate = new Date();
  const dateString = currentDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.setFontSize(8);
  doc.text(`Lançamento em: ${dateString}`, pageWidth - 60, yOffsetItems + 5);
}
// Gera o PDF, salva no banco e redireciona para downloads.html
async function generatePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('portrait', 'mm', 'a4');

  currentServiceNumber = Math.floor(Math.random() * 9000) + 1000;

  addContent(doc, 20);
  doc.line(7, 150, doc.internal.pageSize.width - 7, 150);
  addContent(doc, 165);

  const pdfBase64 = doc.output('datauristring');

  const now = new Date();
  //const nomeArquivo = `autorizacao_servico.pdf`; // <-- nome fixo, sem data e número
  const nomeArquivo = `autorizacao_servico_${currentServiceNumber}.pdf`;
  const dataFormatada = now.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  savePdfToDatabase(nomeArquivo, dataFormatada, pdfBase64);
  listarPdfsSalvos();

  alert(`PDF salvo como "${nomeArquivo}" e listado na seção de downloads.`);
  window.location.href = 'downloads.html';
}



// Adiciona um novo item no formulário
function addItem() {
  const container = document.getElementById('service-items');
  if (container.childElementCount >= maxServices) return;

  const newItem = document.createElement('div');
  newItem.classList.add('service-item');
  newItem.innerHTML = `
    <div class="form-group"><label>Medidas</label><input type="number" class="medidas" required></div>
    <div class="form-group"><label>Marca</label><input type="text" class="marca" required></div>
    <div class="form-group"><label>Série</label><input type="number" class="serie" required></div>
    <div class="form-group"><label>Lonas</label><input type="number" class="lonas" required></div>
    <div class="form-group"><label>Discriminação</label><input type="text" class="discriminacao" required></div>
    <div class="form-group"><label>Desenho</label><input type="text" class="desenho" required></div>
    <div class="form-group"><label>Unitário</label><input type="number" class="unitario" required></div>
    <div class="form-group"><label>Desconto (R$)</label><input type="number" class="desconto" value="0" step="0.01" min="0" onchange="applyDiscount(this)"></div>
    <div class="form-group"><label>Total</label><input type="number" class="total" readonly></div>
    <button type="button" onclick="removeItem(this)">Remover Item</button>
  `;
  container.appendChild(newItem);

  newItem.querySelector('.lonas').addEventListener('input', () => calculateTotal(newItem));
  newItem.querySelector('.unitario').addEventListener('input', () => calculateTotal(newItem));
}

// Calcula total do item
function calculateTotal(item) {
  const lonas = parseFloat(item.querySelector('.lonas').value) || 0;
  const unitario = parseFloat(item.querySelector('.unitario').value) || 0;
  const total = lonas * unitario;
  item.querySelector('.total').value = total.toFixed(2);
  updateTotal();
}

// Aplica desconto e atualiza total
function applyDiscount(input) {
  const item = input.closest('.service-item');
  const lonas = parseFloat(item.querySelector('.lonas').value) || 0;
  const unitario = parseFloat(item.querySelector('.unitario').value) || 0;
  const desconto = parseFloat(input.value) || 0;
  const total = lonas * unitario;
  const totalComDesconto = total - desconto;
  item.querySelector('.total').value = totalComDesconto.toFixed(2);
  updateTotal();
}

// Atualiza total geral na interface
function updateTotal() {
  const totals = document.querySelectorAll('.total');
  let totalValue = 0;
  totals.forEach(t => { totalValue += parseFloat(t.value) || 0; });
  const totalDisplay = document.getElementById('total-value');
  if (totalDisplay) {
    totalDisplay.innerText = `R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

// Remove item da lista
function removeItem(button) {
  button.closest('.service-item').remove();
  updateTotal();
}

// Eventos dos botões
document.getElementById('add-service-btn').addEventListener('click', () => {
  if (clickCount >= maxServices) {
    alert('Você atingiu o limite de 14 serviços.');
    document.getElementById('add-service-btn').disabled = true;
    return;
  }
  addItem();
  clickCount++;
});

document.querySelector('button[type="submit"]').addEventListener('click', e => {
  e.preventDefault();
  generatePDF();
});

// Inicializa ao carregar a página
window.onload = async () => {
  await initDatabase();
  listarPdfsSalvos();
};
