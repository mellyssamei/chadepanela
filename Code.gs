const SHEET_PRODUTOS = 'Produtos';
const SHEET_RESERVAS = 'Reservas';

function doGet(e) {
  const action = (e.parameter.action || 'list').toLowerCase();
  const callback = e.parameter.callback || '';

  try {
    if (action === 'list') {
      return responder(listarProdutos_(), callback);
    }

    if (action === 'reserve') {
      return responder(reservarProduto_(e.parameter), callback);
    }

    return responder({ success: false, message: 'Ação inválida.' }, callback);
  } catch (erro) {
    return responder({ success: false, message: erro.message }, callback);
  }
}

function listarProdutos_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PRODUTOS);

  if (!sheet) {
    return { success: false, message: 'A aba Produtos não foi encontrada.' };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { success: true, produtos: [] };
  }

  const dados = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

  const produtos = dados
    .map((row, index) => {
      const status = String(row[3] || 'Disponível').trim();
      return {
        id: index + 2,
        produto: String(row[0] || '').trim(),
        link: String(row[1] || '').trim(),
        faixa: String(row[2] || '').trim(),
        status: status || 'Disponível',
        reservadoPor: String(row[4] || '').trim(),
        whatsapp: String(row[5] || '').trim(),
        dataReserva: row[6] || '',
        reserved: normalizarStatus_(status) === 'reservado'
      };
    })
    .filter(item => item.produto);

  return { success: true, produtos };
}

function reservarProduto_(params) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetProdutos = ss.getSheetByName(SHEET_PRODUTOS);
    const sheetReservas = ss.getSheetByName(SHEET_RESERVAS);

    if (!sheetProdutos) {
      return { success: false, message: 'A aba Produtos não foi encontrada.' };
    }

    const id = Number(params.id);
    const nome = String(params.nome || '').trim();
    const whatsapp = String(params.whatsapp || '').trim();

    if (!id || id < 2) {
      return { success: false, message: 'Produto inválido.' };
    }

    if (!nome || !whatsapp) {
      return { success: false, message: 'Informe seu nome e WhatsApp para reservar.' };
    }

    const produto = String(sheetProdutos.getRange(id, 1).getValue() || '').trim();
    const link = String(sheetProdutos.getRange(id, 2).getValue() || '').trim();
    const faixa = String(sheetProdutos.getRange(id, 3).getValue() || '').trim();
    const statusAtual = String(sheetProdutos.getRange(id, 4).getValue() || 'Disponível').trim();

    if (!produto) {
      return { success: false, message: 'Produto não encontrado.' };
    }

    if (normalizarStatus_(statusAtual) === 'reservado') {
      return { success: false, message: 'Este presente já foi reservado.' };
    }

    const agora = new Date();

    sheetProdutos.getRange(id, 4).setValue('Reservado');
    sheetProdutos.getRange(id, 5).setValue(nome);
    sheetProdutos.getRange(id, 6).setValue(whatsapp);
    sheetProdutos.getRange(id, 7).setValue(agora);

    if (sheetReservas) {
      sheetReservas.appendRow([agora, produto, faixa, link, nome, whatsapp]);
    }

    return {
      success: true,
      message: 'Presente reservado com sucesso.',
      produto: produto
    };
  } finally {
    lock.releaseLock();
  }
}

function normalizarStatus_(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'reservado' || s === 'reservada') return 'reservado';
  return 'disponivel';
}

function responder(obj, callback) {
  const json = JSON.stringify(obj);

  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
