// ─── PREÇOS DOS PRODUTOS ───────────────────────────────────────────────────────
const precos = {
    vaso:        119.90,
    vela:         59.90,
    difusor:      89.90,
    organizador: 149.90,
    bandeja:      79.90,
    livros:       69.90,
};

// Frete calculado por produto (salvo após consulta)
const freteCalculado = {};

// ─── ANIMAÇÃO AO APARECER NA TELA ─────────────────────────────────────────────
const elementos = document.querySelectorAll(".product-section, .card");

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
        }
    });
}, { threshold: 0.15 });

elementos.forEach((elemento) => {
    elemento.style.opacity = "0";
    elemento.style.transform = "translateY(40px)";
    elemento.style.transition = "all 0.8s cubic-bezier(0.19, 1, 0.22, 1)";
    observer.observe(elemento);
});

// ─── TOGGLE PRODUTO EXPANDÍVEL (um por vez) ───────────────────────────────────
let produtoAberto = null;

function toggleProduto(id) {
    const produto = document.getElementById(id);
    if (!produto) return;

    if (produtoAberto === produto) {
        produto.classList.remove("aberto");
        produtoAberto = null;
        return;
    }

    if (produtoAberto) produtoAberto.classList.remove("aberto");

    produto.classList.add("aberto");
    produtoAberto = produto;
}

// ─── QUANTIDADE ───────────────────────────────────────────────────────────────
function alterarQtd(id, delta) {
    const qtdEl = document.getElementById(`qtd-${id}`);
    if (!qtdEl) return;

    let qtd = parseInt(qtdEl.textContent) + delta;
    if (qtd < 1) qtd = 1;
    if (qtd > 99) qtd = 99;
    qtdEl.textContent = qtd;

    atualizarSubtotal(id, qtd);
}

function atualizarSubtotal(id, qtd) {
    const subtotalEl = document.getElementById(`subtotal-${id}`);
    if (!subtotalEl) return;

    const total = (precos[id] || 0) * qtd;
    subtotalEl.textContent = formatarReais(total);

    // Animação de pulso ao mudar
    subtotalEl.classList.remove('subtotal-animado');
    void subtotalEl.offsetWidth;
    subtotalEl.classList.add('subtotal-animado');
}

// ─── CÁLCULO DE FRETE ─────────────────────────────────────────────────────────
const tabelaFrete = {
    SP: 12.90, RJ: 14.90, MG: 16.90, ES: 17.90,
    PR: 18.90, SC: 19.90, RS: 21.90,
    DF: 22.90, GO: 23.90, MT: 26.90, MS: 25.90,
    BA: 24.90, SE: 25.90, AL: 26.90, PE: 27.90,
    PB: 28.90, RN: 28.90, CE: 29.90, PI: 30.90, MA: 31.90,
    PA: 33.90, AM: 37.90, RO: 35.90, AC: 39.90,
    RR: 39.90, AP: 38.90, TO: 32.90,
};

const tabelaPrazo = {
    SP: 3,  RJ: 4,  MG: 5,  ES: 5,
    PR: 5,  SC: 6,  RS: 7,
    DF: 6,  GO: 7,  MT: 8,  MS: 7,
    BA: 7,  SE: 8,  AL: 8,  PE: 8,
    PB: 9,  RN: 9,  CE: 9,  PI: 10, MA: 10,
    PA: 11, AM: 14, RO: 12, AC: 15,
    RR: 15, AP: 14, TO: 10,
};

async function calcularFrete(inputId, resultadoId) {
    const inputEl     = document.getElementById(inputId);
    const resultadoEl = document.getElementById(resultadoId);
    if (!inputEl || !resultadoEl) return;

    const cepRaw = inputEl.value.replace(/\D/g, '');
    if (cepRaw.length !== 8) {
        mostrarErro(resultadoEl, 'CEP inválido. Digite 8 dígitos.');
        return;
    }

    mostrarCarregando(resultadoEl);

    // Extrai id do produto a partir do inputId (ex: "cep-vaso" → "vaso")
    const produtoId = inputId.replace('cep-', '');

    try {
        const res  = await fetch(`https://viacep.com.br/ws/${cepRaw}/json/`);
        const data = await res.json();

        if (data.erro) { mostrarErro(resultadoEl, 'CEP não encontrado.'); return; }

        const uf    = data.uf;
        const cidade = data.localidade;
        const valor  = tabelaFrete[uf];
        const prazo  = tabelaPrazo[uf];

        if (!valor) { mostrarErro(resultadoEl, 'Estado não reconhecido.'); return; }

        // Salva para usar no finalizarCompra
        freteCalculado[produtoId] = { valor, prazo, cidade, uf, cep: inputEl.value };

        // Subtotal atual (preço × quantidade selecionada)
        const qtdEl   = document.getElementById(`qtd-${produtoId}`);
        const qtd     = qtdEl ? parseInt(qtdEl.textContent) : 1;
        const subtotal = (precos[produtoId] || 0) * qtd;

        mostrarSucesso(resultadoEl, valor, prazo, cidade, uf, subtotal);

        // Preenche campos de endereço automaticamente
        const camposEndereco = document.getElementById(`endereco-${produtoId}`);
        if (camposEndereco) {
            document.getElementById(`rua-${produtoId}`).value    = data.logradouro || '';
            document.getElementById(`bairro-${produtoId}`).value = data.bairro     || '';
            document.getElementById(`numero-${produtoId}`).value = '';
            document.getElementById(`complemento-${produtoId}`).value = '';
            camposEndereco.style.display = 'flex';
            // Foca no campo número para o cliente preencher
            setTimeout(() => document.getElementById(`numero-${produtoId}`).focus(), 100);
        }

    } catch (err) {
        mostrarErro(resultadoEl, 'Erro ao consultar CEP. Tente novamente.');
    }
}

// ─── FINALIZAR COMPRA → MERCADO PAGO ─────────────────────────────────────────
async function finalizarCompra(nomeProduto, preco, id) {
    const frete = freteCalculado[id];

    // Valida: CEP precisa estar calculado
    if (!frete) {
        alert('Por favor, calcule o frete antes de prosseguir.');
        return;
    }

    // Valida: número da casa obrigatório
    const numeroEl = document.getElementById(`numero-${id}`);
    if (!numeroEl?.value.trim()) {
        numeroEl?.focus();
        alert('Por favor, informe o número do endereço.');
        return;
    }

    const qtdEl = document.getElementById(`qtd-${id}`);
    const qtd   = qtdEl ? parseInt(qtdEl.textContent) : 1;

    const endereco = {
        rua:         document.getElementById(`rua-${id}`)?.value.trim()         || '',
        numero:      document.getElementById(`numero-${id}`)?.value.trim()      || '',
        complemento: document.getElementById(`complemento-${id}`)?.value.trim() || '',
        bairro:      document.getElementById(`bairro-${id}`)?.value.trim()      || '',
        cep:         frete.cep,
        cidade:      frete.cidade,
        uf:          frete.uf,
    };

    // Mostra estado de carregamento no botão
    const btn = document.querySelector(`#${id} .btn-produto`);
    const textoOriginal = btn?.innerHTML;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Aguarde...</span>';
    }

    try {
        const res = await fetch('/criar-preferencia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nomeProduto, preco, quantidade: qtd, frete, endereco }),
        });

        const data = await res.json();

        if (data.init_point) {
            window.location.href = data.init_point; // redireciona para o checkout do MP
        } else {
            alert('Erro ao iniciar pagamento. Tente novamente.');
        }
    } catch (err) {
        console.error(err);
        alert('Erro de conexão. Verifique se o servidor está rodando.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = textoOriginal;
        }
    }
}

// ─── MENSAGEM GERAL (botão do rodapé) ─────────────────────────────────────────
function enviarMensagem(produto) {
    const numero = '5527996329418';
    const texto  = encodeURIComponent(`Olá! Gostaria de receber mais informações sobre o produto: ${produto}`);
    window.location.href = `https://api.whatsapp.com/send?phone=${numero}&text=${texto}`;
}

// ─── HELPERS DE UI ────────────────────────────────────────────────────────────
function formatarReais(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mostrarCarregando(el) {
    el.innerHTML = `<span class="frete-loading">Consultando...</span>`;
}

function mostrarErro(el, msg) {
    el.innerHTML = `<span class="frete-erro">⚠ ${msg}</span>`;
}

function mostrarSucesso(el, valor, prazo, cidade, uf, subtotal) {
    const total = subtotal !== undefined ? subtotal + valor : null;
    el.innerHTML = `
        <div class="frete-box">
            <div class="frete-linha frete-cidade">
                <span>📦 ${cidade} - ${uf}</span>
            </div>
            <div class="frete-linha">
                <span class="frete-label">Frete</span>
                <span class="frete-valor">${formatarReais(valor)}</span>
            </div>
            <div class="frete-linha">
                <span class="frete-label">Prazo</span>
                <span class="frete-prazo">até ${prazo} dias úteis</span>
            </div>
            ${total !== null ? `
            <div class="frete-linha frete-total-linha">
                <span class="frete-total-label">Total c/ frete</span>
                <span class="frete-total-valor">${formatarReais(total)}</span>
            </div>` : ''}
        </div>
    `;
}

// ─── MÁSCARA DE CEP + ENTER ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.input-frete').forEach(input => {
        input.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5, 8);
            e.target.value = v;
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const btn = input.nextElementSibling;
                if (btn) btn.click();
            }
        });
    });
});
        
