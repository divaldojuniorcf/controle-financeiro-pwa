// Gera os ícones PNG do app (fundo azul-escuro com três barras), sem dependências.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const AZUL = [0x1f, 0x38, 0x64];
const BRANCO = [0xff, 0xff, 0xff];
const VERDE = [0x00, 0xb0, 0x50];
const AMARELO = [0xff, 0xd9, 0x66];

// Retângulos em fração do lado: [x0, y0, x1, y1, cor]
const FORMAS = [
  [0.2, 0.56, 0.32, 0.76, BRANCO],
  [0.44, 0.42, 0.56, 0.76, BRANCO],
  [0.68, 0.26, 0.8, 0.76, VERDE],
  [0.16, 0.78, 0.84, 0.81, AMARELO],
];

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function bloco(tipo, dados) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dados.length);
  const td = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(lado) {
  const linhas = [];
  for (let y = 0; y < lado; y++) {
    const linha = Buffer.alloc(1 + lado * 3);
    for (let x = 0; x < lado; x++) {
      let cor = AZUL;
      for (const [x0, y0, x1, y1, c] of FORMAS) {
        if (x >= x0 * lado && x < x1 * lado && y >= y0 * lado && y < y1 * lado) cor = c;
      }
      linha.set(cor, 1 + x * 3);
    }
    linhas.push(linha);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", ihdr),
    bloco("IDAT", deflateSync(Buffer.concat(linhas))),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public", { recursive: true });
for (const [nome, lado] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180], ["favicon.png", 64]]) {
  writeFileSync(`public/${nome}`, png(lado));
}
console.log("Ícones gerados em public/");
