# Test Fixtures

This folder contains `.pen` files for testing the Pencil Design Review Action.

## Structure

```
test-fixtures/
├── designs/           # Sample .pen files for testing
│   └── seekhealth.pen # SeekHealth landing page (3 frames)
└── README.md
```

## Adding Test Files

Drop any `.pen` files into the `designs/` folder to use them for testing.

## Running Tests

```bash
# Quick parser test
npx ts-node test-parser.ts

# Full action simulation
npx ts-node test-full.ts
```

## Sample Files

| File | Frames | Description |
|------|--------|-------------|
| `seekhealth.pen` | 3 top-level, 89 total | Landing page + About page |
