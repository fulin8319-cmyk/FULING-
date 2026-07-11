import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const protectedMainFabrics = [
  '單面PK布',
  '細針鳥眼',
  '75D 雙面布',
  '大目鳥眼布',
  'PK健康布',
  'NOP 單面涼感布'
];

const readProjectFile = (relativePath) =>
  readFileSync(join(root, relativePath), 'utf8');

const fail = (message) => {
  console.error(`保護檢查失敗：${message}`);
  process.exitCode = 1;
};

const assertIncludesAll = (label, content) => {
  const missing = protectedMainFabrics.filter((name) => !content.includes(name));
  if (missing.length) {
    fail(`${label} 少了主力布：${missing.join('、')}`);
  }
};

const assertAtLeast = (label, content, pattern, minimum) => {
  const count = (content.match(pattern) || []).length;
  if (count < minimum) {
    fail(`${label} 只找到 ${count} 個，應至少有 ${minimum} 個。`);
  }
};

const indexHtml = readProjectFile('index.html');
const functionalHtml = readProjectFile('functional-fabric.html');

assertIncludesAll('首頁主力布', indexHtml);
assertIncludesAll('機能布頁主力布', functionalHtml);
assertAtLeast('機能布頁主力布卡片', functionalHtml, /class="panel product-card"/g, 6);

if (!indexHtml.includes('ensureHomeFeaturedFallbackCards')) {
  fail('首頁缺少本機預覽備用補齊機制 ensureHomeFeaturedFallbackCards。');
}

if (indexHtml.includes('./functional-fabric"') || indexHtml.includes('./functional-fabric<')) {
  fail('首頁仍有 extensionless 的 functional-fabric 連結，本機 file 預覽可能開不到頁面。');
}

if (!process.exitCode) {
  console.log('保護檢查通過：首頁與機能布頁都保留 6 款主力布。');
}
