# @smeditor/collab

Collaboration groundwork for SMEditor — a document operation model with apply, invert, and operational transform.

Part of [SMEditor](https://github.com/sCruze/smeditor) — a framework-agnostic rich text editor library.

## Install

```bash
npm install @smeditor/collab @smeditor/core
```

## Usage

```ts
import { applyOperation, invertOperation, transformAgainst } from "@smeditor/collab";

const next = applyOperation(doc, op);
const undo = invertOperation(doc, op);
const rebased = transformAgainst(localOp, remoteOps);
```

Пакет даёт модель операций (insert/delete), их применение, инверсию и
операционную трансформацию, а также `CollabSession` для батчинга.
Транспорт и сервер — на стороне приложения.

## Documentation

Полная документация и примеры: https://github.com/sCruze/smeditor#readme

## License

MIT © SMEditor contributors
