# Task: Advanced Text Support

## Objective

Expand text creation and update capabilities so Claude can produce production-quality typography rather than only plain text with font size and fill color.

## New capabilities

- Font family and style selection.
- Line height.
- Letter spacing.
- Horizontal and vertical text alignment.
- Text auto-resize behavior.
- Paragraph indentation and spacing where supported.
- Text decoration where supported.

## Proposed tool changes

Extend `figma_create_text` and `figma_update_node` with:

- `fontFamily?: string`
- `fontStyle?: string`
- `fontSize?: number`
- `lineHeight?: { unit: "PIXELS" | "PERCENT" | "AUTO"; value?: number }`
- `letterSpacing?: { unit: "PIXELS" | "PERCENT"; value: number }`
- `textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED"`
- `textAlignVertical?: "TOP" | "CENTER" | "BOTTOM"`
- `textAutoResize?: "NONE" | "WIDTH_AND_HEIGHT" | "HEIGHT" | "TRUNCATE"`
- `paragraphSpacing?: number`
- `paragraphIndent?: number`

## Implementation approach

1. Add text style schemas in `src/schemas.ts`.
2. Extend text payload type in `PluginCommand`.
3. In `plugin/code.ts`, add `applyTextStyle(node, payload)`.
4. Ensure fonts are loaded before setting font-dependent properties.
5. Update `applyPatch` to apply text styles only to text nodes.
6. Return clear errors if text styling is attempted on non-text nodes.

## Task phases

### Phase 1: Safe text properties

- Add line height, letter spacing, alignment, and auto-resize.
- Keep current font loading behavior.

### Phase 2: Font robustness

- Add fallback behavior if requested font is unavailable.
- Return a clear error with requested font name.
- Consider adding `figma_list_available_fonts` if needed.

### Phase 3: Paragraph and decorative properties

- Add paragraph spacing and indentation.
- Add underline/strikethrough if supported by typings and target Figma runtime.

## Testing after change

### Build tests

```bash
npm run typecheck
npm run build
```

### Functional tests

1. Create a large hero heading with custom line height.
2. Create a paragraph with fixed width and `textAutoResize: "HEIGHT"`.
3. Center-align a button label inside a button frame.
4. Update an existing text node from regular to bold.
5. Update letter spacing on a small uppercase label.
6. Attempt to style a rectangle as text and verify clear error.
7. Attempt to use an unavailable font and verify clear error or fallback behavior.

### Visual tests

- Compare rendered text with expected typography in Figma.
- Verify line wrapping and paragraph height are correct.

## Acceptance criteria

- Claude can create hero sections, project cards, labels, captions, and buttons with consistent typography.
- Text styling works on creation and update.
- Font-loading failures are understandable and recoverable.
