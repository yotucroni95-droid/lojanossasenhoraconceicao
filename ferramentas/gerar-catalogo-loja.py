#!/usr/bin/env python3
"""Gera catalogo-loja.js: produtos do relatório de estoque da loja que têm foto confirmada nos catálogos.
Uso: python3 ferramentas/gerar-catalogo-loja.py
- Estoque vem do relatório (dados-loja/estoque-relatorio-AAAA-MM-DD.tsv), pelo código interno da loja.
- Preço NÃO é publicado (decisão da loja): o cliente consulta pelo WhatsApp.
- Só entram pares exatos (modelo + medida/cor). O que tem conflito fica em PENDENTES, fora da vitrine.
- Ids de produto e variante são estáveis: não renomeie depois de divulgar links."""
import json, re, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
RELATORIO = RAIZ / 'dados-loja/estoque-relatorio-2026-11-23.tsv'

def ler_relatorio():
    r = {}
    for l in RELATORIO.read_text(encoding='utf-8').splitlines():
        c = l.split('\t')
        if len(c) >= 5:
            q = c[2].replace('.', '').replace(',', '.')
            r[c[0]] = {'qtd': float(q) if q else None, 'desc': c[4].strip()}
    return r

def M(l, a, p):
    return {'largura': l, 'altura': a, 'profundidade': p}

NEUTRO = '#d9d2c5'
# Cada variante: (id, nome, código loja, medidas, atributos, cor)
PRODUTOS = [
 # ---------------- J.Confort ----------------
 dict(id='colchao-odin', name='Colchão e base Odin', fabricante='J.Confort', category='colchoes', tag='Linha premium',
  img='jc-odin', fonte=('jconfort-colchoes.pdf', 3),
  description='Conjunto de linha superior da J.Confort, com colchão de 32 cm de altura e revestimento em malha. A base box acompanha o mesmo acabamento em tecido com pespontos em losango, para um quarto de presença elegante.',
  details=['Colchão com 32 cm de altura', 'Revestimento em malha', 'Disponível em Queen e King; base vendida separadamente'],
  variants=[('queen', 'Colchão Queen 158 × 198', '000674', M(158, 32, 198), {'tamanho': 'Queen', 'tipo': 'Colchão'}),
            ('king', 'Colchão King 193 × 203', '000675', M(193, 32, 203), {'tamanho': 'King', 'tipo': 'Colchão'}),
            ('base-queen', 'Base box Queen (bipartida 2 × 79 × 198)', '000676', M(79, 30, 198), {'tamanho': 'Queen', 'tipo': 'Base box'}),
            ('base-king', 'Base box King (bipartida 2 × 96 × 203)', '000677', M(96, 30, 203), {'tamanho': 'King', 'tipo': 'Base box'})]),
 dict(id='colchao-zeus', name='Colchão e base Zeus', fabricante='J.Confort', category='colchoes', tag='Linha premium',
  img='jc-zeus', fonte=('jconfort-colchoes.pdf', 4),
  description='O Zeus combina 32 cm de altura, pillow top e revestimento em malha em um conjunto de tons claros e acabamento sofisticado. Uma escolha para quem busca acolhimento e firmeza na medida certa.',
  details=['Colchão com 32 cm de altura', 'Pillow top com revestimento em malha', 'Solteirão, Queen e King; base vendida separadamente'],
  variants=[('solteirao', 'Colchão Solteirão 88 × 188', '000668', M(88, 32, 188), {'tamanho': 'Solteirão', 'tipo': 'Colchão'}),
            ('queen', 'Colchão Queen 158 × 198', '000669', M(158, 32, 198), {'tamanho': 'Queen', 'tipo': 'Colchão'}),
            ('king', 'Colchão King 193 × 203', '000670', M(193, 32, 203), {'tamanho': 'King', 'tipo': 'Colchão'}),
            ('base-solteirao', 'Base box Solteirão 88 × 188', '000671', M(88, 30, 188), {'tamanho': 'Solteirão', 'tipo': 'Base box'}),
            ('base-queen', 'Base box Queen (bipartida 2 × 79 × 198)', '000672', M(79, 30, 198), {'tamanho': 'Queen', 'tipo': 'Base box'}),
            ('base-king', 'Base box King (bipartida 2 × 96 × 203)', '000673', M(96, 30, 203), {'tamanho': 'King', 'tipo': 'Base box'})]),
 dict(id='cama-box-maestro', name='Cama box conjugada Maestro', fabricante='J.Confort', category='colchoes',
  img='jc-maestro', fonte=('jconfort-colchoes.pdf', 15),
  description='Colchão e base em uma só peça, com 59 cm de altura total. O tampo estampado e a base em cinza trazem um visual atual, e o conjunto conjugado facilita a montagem e a limpeza do quarto.',
  details=['Cama box conjugada: colchão e base juntos', 'Altura total de 59 cm', 'Solteiro e Casal'],
  variants=[('solteiro', 'Solteiro 88 × 188', '000637', M(88, 59, 188), {'tamanho': 'Solteiro', 'tipo': 'Cama box conjugada'}),
            ('casal', 'Casal 138 × 188', '000638', M(138, 59, 188), {'tamanho': 'Casal', 'tipo': 'Cama box conjugada'})]),
 dict(id='cama-box-dijon', name='Cama box conjugada Dijon', fabricante='J.Confort', category='colchoes',
  img='jc-dijon', fonte=('jconfort-colchoes.pdf', 17),
  description='Cama box conjugada de 52 cm com tampo estampado em tons escuros e base preta. Prática, resistente e com visual discreto, combina com qualquer estilo de quarto.',
  details=['Cama box conjugada: colchão e base juntos', 'Altura total de 52 cm', 'Solteiro e Casal'],
  variants=[('solteiro', 'Solteiro 88 × 188', '000631', M(88, 52, 188), {'tamanho': 'Solteiro', 'tipo': 'Cama box conjugada'}),
            ('casal', 'Casal 138 × 188', '000632', M(138, 52, 188), {'tamanho': 'Casal', 'tipo': 'Cama box conjugada'})]),
 dict(id='cama-delicato-auxiliar', name='Cama box Delicato com auxiliar', fabricante='J.Confort', category='colchoes', tag='Duas camas em uma',
  img='jc-delicato', fonte=('jconfort-colchoes.pdf', 18),
  description='Solução inteligente para quartos de hóspedes e de crianças: uma cama box solteirão com cama auxiliar que desliza por baixo. Revestimento em malha e base em azul-marinho.',
  details=['Cama principal com cama auxiliar sob ela', 'Altura total de 59 cm', 'Tamanho Solteirão'],
  variants=[('solteirao', 'Solteirão 88 × 188', '000665', M(88, 59, 188), {'tamanho': 'Solteirão', 'tipo': 'Cama com auxiliar'})]),
 dict(id='colchao-d28-jconfort', name='Colchão de espuma D28 bordado', fabricante='J.Confort', category='colchoes',
  img='jc-d28', fonte=('jconfort-colchoes.pdf', 20),
  description='Colchão de espuma densidade 28 com tecido bordado, indicado para o uso diário de adultos de até cerca de 80 kg. Firmeza equilibrada e ótimo custo-benefício.',
  details=['Espuma densidade D28', 'Tecido bordado', '14 cm de altura'],
  variants=[('solteiro', 'Solteiro 88 × 188 × 14', '000633', M(88, 14, 188), {'tamanho': 'Solteiro', 'densidade': 'D28', 'tipo': 'Colchão'}),
            ('casal', 'Casal 138 × 188 × 14', '000634', M(138, 14, 188), {'tamanho': 'Casal', 'densidade': 'D28', 'tipo': 'Colchão'})]),
 dict(id='colchao-d33-jconfort', name='Colchão de espuma D33 bordado', fabricante='J.Confort', category='colchoes',
  img='jc-d33', fonte=('jconfort-colchoes.pdf', 20),
  description='Colchão de espuma densidade 33, mais firme, com tecido bordado. Boa sustentação para adultos de até cerca de 100 kg e para quem prefere uma superfície mais estável.',
  details=['Espuma densidade D33', 'Tecido bordado', 'Altura a confirmar com a loja'],
  variants=[('solteiro', 'Solteiro 88 × 188', '000635', M(88, None, 188), {'tamanho': 'Solteiro', 'densidade': 'D33', 'tipo': 'Colchão'}),
            ('casal', 'Casal 138 × 188', '000636', M(138, None, 188), {'tamanho': 'Casal', 'densidade': 'D33', 'tipo': 'Colchão'})]),
 dict(id='colchao-d45-jconfort', name='Colchão de espuma D45 bordado', fabricante='J.Confort', category='colchoes',
  img='jc-d45', fonte=('jconfort-colchoes.pdf', 12),
  description='Espuma de alta densidade D45 para máxima firmeza e durabilidade. Indicado para quem precisa de sustentação reforçada. Na foto, o colchão aparece sobre base box (vendida separadamente).',
  details=['Espuma densidade D45', 'Tecido bordado', 'Foto do catálogo: conjunto com base'],
  variants=[('casal', 'Casal 138 × 188', '000640', M(138, None, 188), {'tamanho': 'Casal', 'densidade': 'D45', 'tipo': 'Colchão'})]),
 # ---------------- Titanio ----------------
 dict(id='colchao-realeza-titanio', name='Colchão Realeza molas ensacadas', fabricante='Titanio', category='colchoes', tag='Molas ensacadas',
  img='ti-realeza-amb', extra=['ti-realeza'], fonte=('titanio-2026.pdf', 5),
  description='O topo da linha Titanio: 40 cm de altura, molas ensacadas individualmente e tampo em malha fria de alta gramatura. As molas trabalham de forma independente, reduzindo a transferência de movimento entre quem divide a cama.',
  details=['Molas ensacadas individualmente', 'Tampo em malha fria e espuma D28', 'Colchão com 40 cm de altura'],
  variants=[('198x198', 'Colchão 198 × 198 × 40', '000701', None, {'tipo': 'Colchão', 'tecnologia': 'Molas ensacadas'})],
  conflitos=[{'campo': 'tamanho', 'nota': 'Sistema da loja descreve "198x198 Queen"; Queen padrão é 158 × 198. Confirmar a medida.'}]),
 dict(id='colchao-costa-rica-titanio', name='Colchão e base Costa Rica', fabricante='Titanio', category='colchoes', tag='Molas ensacadas',
  img='ti-costarica-amb', extra=['ti-costarica'], fonte=('titanio-2026.pdf', 9),
  description='Conjunto casal com colchão de molas ensacadas de 35 cm e base box marrom de 30 cm. Tampo em malha fria e camadas de espuma D26 que garantem conforto e boa ventilação.',
  details=['Molas ensacadas individualmente', 'Colchão de 35 cm e base de 30 cm', 'Tamanho Casal 138 × 188'],
  variants=[('colchao-casal', 'Colchão Casal 138 × 188 × 35', '000703', M(138, 35, 188), {'tamanho': 'Casal', 'tipo': 'Colchão', 'tecnologia': 'Molas ensacadas'}),
            ('base-casal', 'Base box Casal 138 × 188 × 30', '000702', M(138, 30, 188), {'tamanho': 'Casal', 'tipo': 'Base box'})]),
 dict(id='colchao-berlim-titanio', name='Colchão Berlim molas ensacadas', fabricante='Titanio', category='colchoes', tag='Molas ensacadas',
  img='ti-berlim-amb', extra=['ti-berlim'], fonte=('titanio-2026.pdf', 25),
  description='Colchão casal de molas ensacadas com 24 cm de altura e acabamento em azul-grafite. Uma porta de entrada para o conforto das molas independentes, com tampo em malha fria.',
  details=['Molas ensacadas individualmente', '24 cm de altura', 'Tamanho Casal 138 × 188'],
  variants=[('colchao-casal', 'Colchão Casal 138 × 188 × 24', '000705', M(138, 24, 188), {'tamanho': 'Casal', 'tipo': 'Colchão', 'tecnologia': 'Molas ensacadas'})]),
 dict(id='colchao-nassau-titanio', name='Colchão e base Nassau', fabricante='Titanio', category='colchoes', tag='Molas ensacadas',
  img='ti-nassau-amb', extra=['ti-nassau'], fonte=('titanio-2026.pdf', 27),
  description='Contraste elegante entre o tampo claro e a base preta. Colchão de molas ensacadas com 22 cm e base box de 30 cm, ideal para quem quer o conforto das molas em um conjunto mais baixo.',
  details=['Molas ensacadas individualmente', 'Colchão de 22 cm e base de 30 cm', 'Tamanho Casal 138 × 188'],
  variants=[('colchao-casal', 'Colchão Casal 138 × 188 × 22', '000707', M(138, 22, 188), {'tamanho': 'Casal', 'tipo': 'Colchão', 'tecnologia': 'Molas ensacadas'}),
            ('base-casal', 'Base box Casal 138 × 188 × 30', '000706', M(138, 30, 188), {'tamanho': 'Casal', 'tipo': 'Base box'})]),
 # ---------------- Caza Nobre ----------------
 dict(id='colchao-montevideu', name='Colchão Montevidéu', fabricante='Caza Nobre', category='colchoes',
  img='cn-montevideu', fonte=('caza-nobre-2026-06.pdf', 18),
  description='Colchão casal de 30 cm em acabamento cinza, com tampo acolchoado e laterais reforçadas. Conforto macio na superfície com boa sustentação.',
  details=['30 cm de altura', 'Acabamento cinza', 'Tamanho Casal 138 × 188'],
  variants=[('casal-cinza', 'Casal 138 × 188 × 30 · Cinza', '000515', M(138, 30, 188), {'tamanho': 'Casal', 'tipo': 'Colchão'})]),
 dict(id='colchao-oxford', name='Colchão Oxford', fabricante='Caza Nobre', category='colchoes',
  img='cn-oxford', fonte=('caza-nobre-2026-06.pdf', 23),
  description='Colchão de 24 cm com tampo acolchoado e faixa lateral personalizada. Uma opção confortável e equilibrada para o dia a dia, em tamanhos casal e queen.',
  details=['24 cm de altura', 'Tampo acolchoado', 'Foto do catálogo: conjunto com base cinza (vendida separadamente)'],
  variants=[('casal', 'Casal 138 × 188 × 24', '000736', M(138, 24, 188), {'tamanho': 'Casal', 'tipo': 'Colchão'}),
            ('queen', 'Queen 158 × 198 × 24', '000735', M(158, 24, 198), {'tamanho': 'Queen', 'tipo': 'Colchão'})]),
 dict(id='colchao-omega', name='Colchão Ômega', fabricante='Caza Nobre', category='colchoes',
  img='cn-omega', fonte=('caza-nobre-2026-06.pdf', 14),
  description='Colchão solteirão de 25 cm com tampo acolchoado de visual sofisticado. Na foto, aparece sobre base box azul-marinho, vendida separadamente.',
  details=['25 cm de altura', 'Tamanho Solteirão 88 × 188', 'Foto do catálogo: conjunto casal com base'],
  variants=[('solteirao', 'Solteirão 88 × 188 × 25', '000516', M(88, 25, 188), {'tamanho': 'Solteirão', 'tipo': 'Colchão'})]),
 dict(id='base-luxor', name='Base box Luxor cotelê bege', fabricante='Caza Nobre', category='colchoes',
  img='cn-luxor', fonte=('caza-nobre-2026-06.pdf', 12),
  description='Base box em tecido cotelê bege, de 30 cm, que valoriza o quarto com textura e tom neutro. Na foto, o conjunto casal com colchão; o item disponível é a base solteirão.',
  details=['Tecido cotelê bege', '30 cm de altura', 'Tamanho Solteirão 88 × 188'],
  variants=[('solteirao', 'Solteirão 88 × 188 × 30', '000514', M(88, 30, 188), {'tamanho': 'Solteirão', 'tipo': 'Base box'})]),
 dict(id='colchao-lotus', name='Colchão Lotus D33', fabricante='Caza Nobre', category='colchoes',
  img='cn-lotus', fonte=('caza-nobre-2026-06.pdf', 42),
  description='Colchão de espuma densidade 33, firme e durável, com tampo acolchoado e laterais em azul-marinho. Disponível em diferentes alturas e tamanhos.',
  details=['Espuma densidade D33', 'Tampo acolchoado', 'Alturas de 17 e 20 cm'],
  variants=[('solteiro-17', 'Solteiro 88 × 188 × 17', '000495', M(88, 17, 188), {'tamanho': 'Solteiro', 'densidade': 'D33', 'tipo': 'Colchão'}),
            ('casal-17', 'Casal 138 × 188 × 17', '000370', M(138, 17, 188), {'tamanho': 'Casal', 'densidade': 'D33', 'tipo': 'Colchão'}),
            ('casal-20', 'Casal 138 × 188 × 20', '000371', M(138, 20, 188), {'tamanho': 'Casal', 'densidade': 'D33', 'tipo': 'Colchão'})]),
 dict(id='colchao-ouro-d20', name='Colchão Ouro D20', fabricante='Caza Nobre', category='colchoes',
  img='cn-ouro', fonte=('caza-nobre-2026-06.pdf', 46),
  description='Colchão de espuma densidade 20 com 12 cm de altura, leve e prático. Indicado para uso eventual, quarto de hóspedes ou para quem procura uma opção acessível.',
  details=['Espuma densidade D20', '12 cm de altura', 'Solteiro e Casal'],
  variants=[('solteiro', 'Solteiro 78 × 188 × 12', '000734', M(78, 12, 188), {'tamanho': 'Solteiro', 'densidade': 'D20', 'tipo': 'Colchão'}),
            ('casal', 'Casal 138 × 188 × 12', '000369', M(138, 12, 188), {'tamanho': 'Casal', 'densidade': 'D20', 'tipo': 'Colchão'})]),
 dict(id='colchao-baby-fofo', name='Colchão de berço Baby Fofo', fabricante='Caza Nobre', category='colchoes',
  img='cn-babyfofo', fonte=('caza-nobre-2026-06.pdf', 47),
  description='Colchão para berço no tamanho padrão 60 × 130 cm, com revestimento claro e macio. Feito para o descanso dos pequenos.',
  details=['Tamanho padrão de berço 60 × 130', 'Revestimento claro', 'Altura a confirmar com a loja'],
  variants=[('berco', 'Berço 60 × 130', '000270', M(60, None, 130), {'tamanho': 'Berço', 'tipo': 'Colchão'})]),
 # ---------------- Tuboarte ----------------
 dict(id='rack-camille', name='Rack Camille', fabricante='Tuboarte', category='sala', tag='Palhinha',
  img='tb-camille', fonte=('tuboarte-2026-09.pdf', 53),
  description='Rack de linhas retrô com pés palito, porta em palhinha e nichos abertos para organizar aparelhos e objetos de decoração. Acabamento Off White com tampo Freijó.',
  details=['Porta com detalhe em palhinha', 'Nichos abertos e pés palito', 'Acabamento Off White / Freijó'],
  variants=[('off-white-freijo', 'Off White / Freijó', '000771', M(151, 64.2, 40), {'acabamento': 'Off White / Freijó'}, '#e8dfcc')]),
 dict(id='rack-suellen', name='Rack Suellen', fabricante='Tuboarte', category='sala', tag='Palhinha',
  img='tb-suellen', fonte=('tuboarte-2026-09.pdf', 54),
  description='Rack amplo, com quase 2 metros, duas portas de correr em palhinha e nichos centrais. Une o calor do Freijó ao Off White em um móvel que é protagonista da sala.',
  details=['Portas de correr em palhinha', 'Nichos centrais abertos', 'Acabamento Freijó / Off White'],
  variants=[('freijo-off-white', 'Freijó / Off White', '000772', M(192.4, 64.2, 38.4), {'acabamento': 'Freijó / Off White'}, '#c89b62')]),
 dict(id='painel-flavia', name='Painel para TV Flávia', fabricante='Tuboarte', category='sala',
  img='tb-flavia', fonte=('tuboarte-2026-09.pdf', 57),
  description='Painel compacto para TVs de até 43", com prateleira suspensa e nichos para aparelhos. Ideal para salas e quartos que pedem organização sem ocupar o piso.',
  details=['Suporta TVs de até 43"', 'Prateleira suspensa com nichos', 'Catálogo: Off White/Freijó ou Rippas/Freijó'],
  variants=[('cod-000781', 'Opção cód. 000781', '000781', M(120, 90, 33.2), {}, '#e8dfcc'),
            ('cod-000782', 'Opção cód. 000782', '000782', M(120, 90, 33.2), {}, '#c89b62')],
  conflitos=[{'campo': 'acabamento de cada código', 'nota': 'Relatório tem dois códigos sem cor; catálogo oferece Off White/Freijó e Rippas/Freijó.'}]),
 dict(id='cristaleira-stambul', name='Cristaleira Stambul com LED', fabricante='Tuboarte', category='complementos', tag='Com LED',
  img='tb-stambul', fonte=('tuboarte-2026-09.pdf', 142),
  description='Cristaleira alta em Freijó com portas de vidro, fita de LED, adega para vinhos e dobradiças com fechamento suave. Exibe louças e taças com um toque de sofisticação.',
  details=['Fita de LED e adega para vinhos', 'Dobradiças slow motion', 'Acabamento Freijó'],
  variants=[('freijo', 'Freijó', '000778', M(70, 220, 54.4), {'acabamento': 'Freijó'}, '#c08a52')]),
 dict(id='cristaleira-maya-new', name='Cristaleira Maya New', fabricante='Tuboarte', category='complementos',
  img='tb-maya', fonte=('tuboarte-2026-09.pdf', 139),
  description='Cristaleira de duas portas com vidro, prateleiras internas e pés altos de linhas delicadas. Compacta, cabe bem em salas de jantar e cantos de estar.',
  details=['Duas portas com vidro', 'Pés altos', 'Catálogo: Freijó, Off White ou Freijó/Off White'],
  variants=[('cod-000779', 'Opção cód. 000779', '000779', M(61.9, 175.5, 40), {}, '#c08a52'),
            ('cod-000780', 'Opção cód. 000780', '000780', M(61.9, 175.5, 40), {}, '#e8dfcc')],
  conflitos=[{'campo': 'acabamento de cada código', 'nota': 'Relatório tem dois códigos sem cor; catálogo oferece três acabamentos.'}]),
 dict(id='mesa-centro-sibele', name='Mesa de centro Sibele', fabricante='Tuboarte', category='sala',
  img='tb-sibele', fonte=('tuboarte-2026-09.pdf', 144),
  description='Mesa de centro de tampo Off White com cantos suaves e pés palito em madeira. Leve e moderna, completa a sala com elegância.',
  details=['Pés em madeira', 'Tampo Off White', 'Acabamento Freijó / Off White'],
  variants=[('freijo-off-white', 'Freijó / Off White', '000783', M(90, 36.8, 53), {'acabamento': 'Freijó / Off White'}, '#e8dfcc')]),
 dict(id='sala-jantar-tais-120', name='Sala de jantar Taís 1,20 com 4 cadeiras', fabricante='Tuboarte', category='jantar',
  img='tb-tais120', fonte=('tuboarte-2026-09.pdf', 131),
  description='Conjunto de jantar em Freijó com mesa de 1,20 m e quatro cadeiras Star de assento estofado. Robusto e acolhedor, perfeito para as refeições em família.',
  details=['Mesa 120 × 80 cm com tampo em MDF', 'Cadeiras com espuma D23, suportam até 115 kg', 'Acabamento Freijó'],
  variants=[('freijo', 'Freijó · 4 cadeiras Star', '000768', M(120, 80, 80), {'acabamento': 'Freijó', 'lugares': '4 lugares'}, '#c08a52')]),
 # ---------------- JW Estofados ----------------
 dict(id='poltrona-dubai', name='Poltrona do papai Dubai', fabricante='JW Estofados', category='estofados', tag='Reclinável',
  img='jw-dubai', fonte=('jw-2026-06.pdf', 31),
  description='Poltrona reclinável de encosto alto e braços acolchoados, feita para relaxar. Disponível em corano e em veludo, em tons que combinam com qualquer sala.',
  details=['Reclinável', 'Opções em corano ou veludo', 'Na foto: duas cores do modelo'],
  variants=[('corano-preto', 'Corano preto', '000423', None, {'acabamento': 'Corano preto'}, '#232120'),
            ('corano-ocre', 'Corano ocre', '000424', None, {'acabamento': 'Corano ocre'}, '#9a6a3c'),
            ('veludo-chocolate', 'Veludo chocolate', '000721', None, {'acabamento': 'Veludo chocolate'}, '#5a3b2b'),
            ('veludo-grafite', 'Veludo grafite', '000722', None, {'acabamento': 'Veludo grafite'}, '#4a4a4c')]),
]

# Itens do relatório com foto encontrada, mas fora da vitrine até a loja confirmar.
PENDENTES = [
 ('000704', 'Base Berlim: relatório diz 40 cm de altura; catálogo Titanio mostra base de 30 cm.'),
 ('000667', 'Base Máximo: existe linha Máximo na J.Confort e na Titanio; confirmar fabricante.'),
 ('000740', 'Colchão Athenas Ice 32 cm: catálogos têm Athenas 18/20 cm (J.Confort) e Athenas Premium (Caza Nobre); confirmar.'),
 ('000742', 'Colchão Athenas Ice 32 cm azul: mesma dúvida do 000740.'),
 ('000653', 'Colchão Montevidéu solteirão: cor não informada (catálogo tem cinza e azul).'),
 ('000641', 'Colchão Oxford casal "MPS": mesma medida do 000736; confirmar se é duplicidade no sistema.'),
 ('000737', 'Colchão Lotus 14 cm chumbo: catálogo mostra Lotus em azul-marinho.'),
 ('000738', 'Colchão Lotus 14 cm solteiro chumbo: idem.'),
 ('000284', 'Colchão D20 12 cm 78 × 188 "Ouro": mesma medida do 000734; confirmar se é duplicidade.'),
 ('000639', 'Colchão D45 J.Confort: medida no sistema "0,88 × 1,38" parece erro de digitação (provável 0,88 × 1,88).'),
 ('000769', 'Sala Taís 1,60 + 6 cadeiras Star: catálogo só mostra a 1,60 com cadeira Eduarda.'),
 ('000699', 'Cozinha Nice: sistema diz Cinamo/Off; catálogo Tuboarte usa Freijó/Off White e Freijó/Cinza.'),
 ('000770', 'Painel Sevilha: sistema diz TV até 70"; catálogo Tuboarte diz até 65".'),
 ('000777', 'Aparador Oregon: sistema diz "c/ tampo madeira"; catálogo mostra tampo Off White.'),
 ('000773', 'Sala Helena 1,20 + 4 cadeiras Coral pés madeira: catálogo mostra Coral com pé MDF.'),
 ('000774', 'Sala Helena 1,20 (segundo código): idem.'),
 ('000775', 'Sala Helena 1,60 + 6 cadeiras Coral: sem foto exata no catálogo.'),
 ('000776', 'Sala Helena 1,60 (segundo código): idem.'),
 ('000725', 'Conjunto Valência veludo castor: catálogo JW mostra Valência só em azul.'),
 ('000726', 'Conjunto Valência veludo cinza: idem.'),
 ('000539', 'Estofado Valência veludo cinza: idem.'),
 ('000723', 'Conjunto Nápoles veludo terracota: catálogo JW mostra Nápoles em cinza.'),
 ('000724', 'Conjunto Nápoles veludo vermelho: idem.'),
 ('000533', 'Estofado Nápoles veludo castor: idem.'),
 ('000535', 'Estofado Nápoles bouclê marrom: idem.'),
 ('000542', 'Estofado Montana veludo: catálogo JW tem "Montana New"; confirmar modelo e cor.'),
 ('000536', 'Estofado Santiago linho bege: catálogo JW mostra Santiago em outro tom.'),
 ('000731', 'Conjunto Montreal 47 cm: catálogo Caza Nobre tem Montreal e Montreal Premium; confirmar qual.'),
]

def main():
    rel = ler_relatorio()
    saida, erros = [], []
    for n, d in enumerate(PRODUTOS, start=101):
        arquivo, pagina = d['fonte']
        variants = []
        for item in d['variants']:
            vid, nome, cod, med, attrs = item[:5]
            cor = item[5] if len(item) > 5 else NEUTRO
            r = rel.get(cod)
            if not r:
                erros.append(cod); continue
            q = r['qtd']
            estoque = None if q is None else max(0, int(q))
            v = {'id': vid, 'name': nome, 'color': cor, 'image': 'assets/catalogo/' + d['img'] + '.jpg', 'imageTipo': 'catalogo',
                 'sku': cod, 'descricaoLoja': r['desc'], 'preco': None, 'parcelado': None, 'estoque': estoque,
                 'medidas': med, 'atributos': attrs}
            if q is not None and q < 0:
                v['alertaEstoque'] = 'Relatório com saldo negativo (' + str(q) + '); exibido como 0.'
            variants.append(v)
        p = {'id': d['id'], 'ref': 'NSC-' + str(n), 'fabricante': d['fabricante'], 'name': d['name'], 'category': d['category'],
             'description': d['description'], 'details': d['details'],
             'images': [{'src': 'assets/catalogo/' + e + '.jpg', 'tipo': 'catalogo', 'alt': d['name'] + ' — foto do catálogo do fabricante'} for e in d.get('extra', [])],
             'variants': variants,
             'fontes': [{'campo': 'fotos e medidas do modelo', 'arquivo': 'dados-loja/catalogos/' + arquivo, 'pagina': str(pagina)},
                        {'campo': 'códigos e estoque', 'arquivo': RELATORIO.relative_to(RAIZ).as_posix()}]}
        if d.get('tag'): p['tag'] = d['tag']
        if d.get('conflitos'): p['conflitos'] = d['conflitos']
        saida.append(p)
    pend = [{'codigo': c, 'descricaoLoja': rel.get(c, {}).get('desc'), 'motivo': m} for c, m in PENDENTES]
    js = ('// GERADO por ferramentas/gerar-catalogo-loja.py a partir do relatório de estoque e dos catálogos.\n'
          '// Não edite à mão: ajuste o script e gere de novo. Ids são estáveis (links divulgados).\n'
          '// "sku" = código interno da loja (para dar baixa no sistema). Preços não são publicados.\n'
          'export const produtosLoja = ' + json.dumps(saida, ensure_ascii=False, indent=1) + ';\n\n'
          'export const pendentesLoja = ' + json.dumps(pend, ensure_ascii=False, indent=1) + ';\n')
    (RAIZ / 'catalogo-loja.js').write_text(js, encoding='utf-8')
    codigos = sum(len(p['variants']) for p in saida)
    print(f'{len(saida)} produtos, {codigos} códigos da loja com foto; {len(pend)} pendentes; códigos não achados: {erros}')
    if erros: sys.exit(1)

main()
