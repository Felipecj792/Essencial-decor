const express    = require('express');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const cors       = require('cors');
const path       = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ─── Serve os arquivos do site ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '.')));
app.use('/style.css', express.static(path.join(__dirname, 'style.css')));
app.use('/script.js', express.static(path.join(__dirname, 'script.js')));
// ─── Credenciais via variável de ambiente (configurada no Railway) ─────────────
const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN,
});

// ─── URL base do site (Railway injeta automaticamente) ────────────────────────
const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : 'http://localhost:3000';

// ─── Rota: criar preferência de pagamento ─────────────────────────────────────
app.post('/criar-preferencia', async (req, res) => {
    const { nomeProduto, preco, quantidade, frete, endereco } = req.body;

    const totalFrete = parseFloat((frete?.valor || 0).toFixed(2));

    try {
        const preference = new Preference(client);

        const result = await preference.create({
            body: {
                items: [
                    {
                        title:       nomeProduto,
                        quantity:    quantidade,
                        unit_price:  preco,
                        currency_id: 'BRL',
                    },
                    ...(totalFrete > 0 ? [{
                        title:       `Frete — ${frete.cidade}/${frete.uf} (${frete.prazo} dias úteis)`,
                        quantity:    1,
                        unit_price:  totalFrete,
                        currency_id: 'BRL',
                    }] : []),
                ],

                payer: {
                    address: {
                        street_name:   endereco?.rua    || '',
                        street_number: endereco?.numero || '',
                        zip_code:      endereco?.cep?.replace('-', '') || '',
                    },
                },

                // URLs de retorno usando o domínio real do Railway
                back_urls: {
                    success: `${BASE_URL}/sucesso.html`,
                    failure: `${BASE_URL}/erro.html`,
                    pending: `${BASE_URL}/pendente.html`,
                },
                auto_return: 'approved',

                external_reference: `${nomeProduto}-${Date.now()}`,
                expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
        });

        res.json({ init_point: result.init_point });

    } catch (err) {
        console.error('Erro MP:', err);
        res.status(500).json({ erro: 'Erro ao criar preferência de pagamento.' });
    }
});

// ─── Inicia o servidor ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor rodando na porta ${PORT}`);
});
