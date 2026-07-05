# kle-serial

Modern TypeScript KLE (Keyboard Layout Editor) JSON parser and serializer.

- Pure ESM, Zod validated
- Behavioral parity with [keyboard-layout-editor](https://github.com/ijprest/keyboard-layout-editor)
- Fixed known bugs from the original [kle-serial](https://github.com/ijprest/kle-serial)

## Install

```bash
pnpm add kle-serial
```

## Usage

```ts
import { deserialize, parse, serialize, sortKeys } from 'kle-serial'

// From raw array
const kb = deserialize([['Q', 'W', 'E', 'R', 'T', 'Y']])

// From JSON/JSON5 string
const kb2 = parse('[["Q","W","E","R","T","Y"]]')

// Back to raw array
const raw = serialize(kb)
```

## API

| Function | Description |
|---|---|
| `deserialize(rows)` | Parse KLE JSON array into `Keyboard` |
| `parse(json)` | Parse JSON/JSON5 string into `Keyboard` |
| `serialize(keyboard)` | Serialize `Keyboard` back to KLE JSON array |
| `sortKeys(keys)` | Sort keys by rotation then position |

## Acknowledgments

- [ijprest/keyboard-layout-editor](https://github.com/ijprest/keyboard-layout-editor) — the original KLE parser this library is based on
- [ijprest/kle-serial](https://github.com/ijprest/kle-serial) — the original serialization library this project replaces

## License

MIT
