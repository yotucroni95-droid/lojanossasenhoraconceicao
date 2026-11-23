#!/usr/bin/env python3
"""Lê o texto extraído do relatório de estoque da loja (PDF -> texto) e gera linhas código/descrição/qtd/valor.
Uso: python3 ferramentas/ler-relatorio.py texto.txt > saida.tsv
Regras para a ordem irregular do PDF:
 - cada produto tem uma linha "000123 UN qtd valor total";
 - a descrição visível vem logo antes da linha do código; se não houver, é a linha seguinte;
 - texto que continua depois do código (cor, medida, voltagem) pertence ao mesmo produto."""
import re, sys
COD = re.compile(r'^(\d{6}) (UNI|UN|Un|PC|CJ)\s*(-?[\d.]+,\d{3})?\s*(-?[\d.]+,\d{2})?\s*(-?[\d.]+,\d{2})?(.*)$')
NUMS = re.compile(r'^(-?[\d.]+,\d{3}) (-?[\d.]+,\d{2}) (-?[\d.]+,\d{2})$')
linhas = [l.strip() for l in open(sys.argv[1], encoding='utf-8') if l.strip() and not l.startswith('=== PAGINA') and l.strip() != 'D']
regs, pend, aguardando = [], [], None
i = 0
while i < len(linhas):
    l = linhas[i]; m = COD.match(l)
    if m:
        cod, un, q, v, t, resto = m.groups()
        if q is None and i + 1 < len(linhas) and NUMS.match(linhas[i + 1]):
            q, v, t = NUMS.match(linhas[i + 1]).groups(); i += 1
        r = {'cod': cod, 'un': un.upper(), 'qtd': q, 'valor': v, 'desc': None, 'extra': []}
        if pend:
            # descrição = primeira linha pendente; as anteriores (se houver) eram continuação do produto anterior
            if regs and len(pend) > 1: regs[-1]['extra'] += pend[:-1]
            r['desc'] = pend[-1]; pend = []; aguardando = None
        else:
            aguardando = r
        resto = resto.strip()
        regs.append(r)
        if resto:  # texto colado na mesma linha dos números é a descrição deste código
            if r['desc'] is None: r['desc'] = resto; aguardando = None
            else: pend.append(resto)
        i += 1; continue
    if aguardando is not None and aguardando['desc'] is None:
        aguardando['desc'] = l; aguardando = None
    elif regs and (re.match(r'^[\d.,]+ \|\|', l) or (regs[-1]['desc'] and '||' in regs[-1]['desc'] and regs[-1]['desc'].startswith(l))):
        regs[-1]['extra'].append(l)   # repetição do texto "|| MODELO" do sistema da loja
    else:
        pend.append(l)
    i += 1
for r in regs:
    print('\t'.join([r['cod'], r['un'], r['qtd'] or '', r['valor'] or '', r['desc'] or '?', ' '.join(r['extra'])]))
