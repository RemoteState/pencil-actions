# Test Fixtures

This folder contains `.pen` files for testing the Pencil Design Review Action.

## Structure

```
test-fixtures/
├── designs/           # Sample .pen files for testing
│   └── random.pen     # Interview Express admin dashboard (8 frames)
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
| `random.pen` | 8 screens | Interview Express - AI interview admin dashboard with Dashboard, Interviews, Candidates, Questions Bank, AI Settings, Analytics, Job Positions, and Settings screens |
