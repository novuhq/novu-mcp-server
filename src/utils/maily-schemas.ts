/**
 * Maily TipTap JSON Schema for AI Generation.
 *
 * Factory functions return fresh Zod instances on each call so that
 * `zod-to-json-schema` does not hoist nested schemas into shared `$defs`
 * (some MCP clients reject deeply nested or duplicated `$ref` chains).
 *
 * Keep in sync with the Novu Maily renderer node/mark properties.
 */
import { z } from "zod";

function createMailyMarkSchema() {
	return z.object({
		type: z.enum(["bold", "italic", "underline", "strike", "code"]),
	});
}

function createMailyTextStyleMarkSchema() {
	return z.object({
		type: z.enum(["textStyle"]),
		attrs: z.object({
			color: z.string().nullable().describe("Text color in hex format"),
		}),
	});
}

function createMailyLinkMarkSchema() {
	return z.object({
		type: z.enum(["link"]),
		attrs: z.object({
			href: z
				.string()
				.describe(
					'Link URL. When isUrlVariable is true, must be a bare variable name without curly braces, e.g. "payload.link" — never "{{ payload.link }}"',
				),
			target: z.enum(["_blank", "_self"]).nullable(),
			rel: z.string().nullable(),
			isUrlVariable: z
				.boolean()
				.nullable()
				.describe(
					'Set true when "href" is a variable reference. The "href" value must then be a bare variable name without {{ }}',
				),
			aliasFor: z
				.string()
				.nullable()
				.describe(
					"Alias for the variable name like payload.items.variableName. Required only when variable is used inside the repeat node.",
				),
		}),
	});
}

function createMailyTextNodeSchema({ plainText = false } = {}) {
	if (plainText) {
		return z.object({
			type: z.enum(["text"]),
			text: z.string(),
		});
	}

	return z.object({
		type: z.enum(["text"]),
		text: z.string(),
		marks: z
			.array(
				z.discriminatedUnion("type", [
					createMailyMarkSchema(),
					createMailyTextStyleMarkSchema(),
					createMailyLinkMarkSchema(),
				]),
			)
			.nullable(),
	});
}

function createMailyVariableNodeSchema() {
	return z.object({
		type: z.enum(["variable"]),
		attrs: z.object({
			id: z
				.string()
				.describe(
					"Variable name like subscriber.firstName or payload.companyName",
				),
			label: z.string().nullable(),
			fallback: z.string().nullable(),
			required: z.boolean().nullable(),
			aliasFor: z
				.string()
				.nullable()
				.describe(
					"Alias for the variable name like payload.items.variableName. Required only when variable is used inside the repeat node.",
				),
		}),
	});
}

function createMailyHardBreakSchema() {
	return z.object({
		type: z.enum(["hardBreak"]),
	});
}

function createMailyButtonSchema() {
	return z.object({
		type: z.enum(["button"]),
		attrs: z.object({
			text: z
				.string()
				.describe(
					'Button label text. When isTextVariable is true, must be a bare variable name without curly braces, e.g. "payload.actionUrl"',
				),
			url: z
				.string()
				.nullable()
				.describe(
					'Button link URL. When isUrlVariable is true, must be a bare variable name without curly braces, e.g. "payload.actionUrl" — never "{{ payload.actionUrl }}"',
				),
			isTextVariable: z
				.boolean()
				.nullable()
				.describe(
					'Set true when "text" is a variable reference. The "text" value must then be a bare variable name without {{ }}',
				),
			isUrlVariable: z
				.boolean()
				.nullable()
				.describe(
					'Set true when "url" is a variable reference. The "url" value must then be a bare variable name without {{ }}',
				),
			alignment: z.enum(["left", "center", "right"]).nullable(),
			variant: z.enum(["filled", "outline"]).nullable(),
			borderRadius: z.enum(["smooth", "sharp", "round"]).nullable(),
			buttonColor: z.string().nullable().describe("Hex color like #000000"),
			textColor: z.string().nullable().describe("Hex color like #ffffff"),
			showIfKey: z.string().nullable(),
			paddingTop: z.number().nullable(),
			paddingRight: z.number().nullable(),
			paddingBottom: z.number().nullable(),
			paddingLeft: z.number().nullable(),
			width: z.string().nullable(),
			aliasFor: z
				.string()
				.nullable()
				.describe(
					"Alias for the variable name like payload.items.variableName. Required only when variable is used inside the repeat node.",
				),
		}),
	});
}

function createMailyInlineContentSchema({ plainText = false } = {}) {
	return z.discriminatedUnion("type", [
		createMailyTextNodeSchema({ plainText }),
		createMailyVariableNodeSchema(),
		createMailyHardBreakSchema(),
		createMailyButtonSchema(),
	]);
}

function createMailyParagraphSchema({ plainText = false } = {}) {
	return z.object({
		type: z.enum(["paragraph"]),
		attrs: z
			.object({
				textAlign: z.enum(["left", "center", "right"]).nullable(),
				showIfKey: z.string().nullable(),
			})
			.nullable(),
		content: z.array(createMailyInlineContentSchema({ plainText })).nullable(),
	});
}

function createMailyHeadingSchema({ plainText = false } = {}) {
	return z.object({
		type: z.enum(["heading"]),
		attrs: z.object({
			level: z
				.union([z.literal(1), z.literal(2), z.literal(3)])
				.describe(
					"Heading level: 1 for main title, 2 for section, 3 for subsection",
				),
			textAlign: z.enum(["left", "center", "right"]).nullable(),
			showIfKey: z.string().nullable(),
		}),
		content: z.array(createMailyInlineContentSchema({ plainText })).nullable(),
	});
}

function createMailySpacerSchema() {
	return z.object({
		type: z.enum(["spacer"]),
		attrs: z.object({
			height: z
				.number()
				.describe("Height in pixels, typically 8, 16, 24, or 32"),
			showIfKey: z.string().nullable(),
		}),
	});
}

function createMailyDividerSchema() {
	return z.object({
		type: z.enum(["horizontalRule"]),
		attrs: z
			.object({
				marginTop: z.number().nullable(),
				marginBottom: z.number().nullable(),
				showIfKey: z.string().nullable(),
			})
			.nullable(),
	});
}

function createMailyImageSchema() {
	return z.object({
		type: z.enum(["image"]),
		attrs: z.object({
			src: z
				.string()
				.describe(
					'Image source URL. When isSrcVariable is true, must be a bare variable name without curly braces, e.g. "payload.imageUrl"',
				),
			isSrcVariable: z
				.boolean()
				.nullable()
				.describe(
					'Set true when "src" is a variable reference. The "src" value must then be a bare variable name without {{ }}',
				),
			alt: z.string().nullable().describe("Alt text for accessibility"),
			title: z.string().nullable(),
			width: z.union([z.number(), z.enum(["auto"])]).nullable(),
			height: z.union([z.number(), z.enum(["auto"])]).nullable(),
			alignment: z.enum(["left", "center", "right"]).nullable(),
			externalLink: z
				.string()
				.nullable()
				.describe(
					"Optional link when image is clicked. When isExternalLinkVariable is true, must be a bare variable name without curly braces",
				),
			isExternalLinkVariable: z
				.boolean()
				.nullable()
				.describe(
					'Set true when "externalLink" is a variable reference. The "externalLink" value must then be a bare variable name without {{ }}',
				),
			borderRadius: z.number().nullable(),
			showIfKey: z.string().nullable(),
			aliasFor: z
				.string()
				.nullable()
				.describe(
					"Alias for the variable name like payload.items.variableName. Required only when variable is used inside the repeat node.",
				),
		}),
	});
}

function createMailyInlineImageSchema() {
	return z.object({
		type: z.enum(["inlineImage"]),
		attrs: z.object({
			height: z.number().nullable(),
			width: z.number().nullable(),
			src: z
				.string()
				.describe(
					'Image source URL. When isSrcVariable is true, must be a bare variable name without curly braces, e.g. "payload.imageUrl"',
				),
			isSrcVariable: z
				.boolean()
				.nullable()
				.describe(
					'Set true when "src" is a variable reference. The "src" value must then be a bare variable name without {{ }}',
				),
			alt: z.string().nullable(),
			title: z.string().nullable(),
			externalLink: z
				.string()
				.nullable()
				.describe(
					"Optional link URL. When isExternalLinkVariable is true, must be a bare variable name without curly braces",
				),
			isExternalLinkVariable: z
				.boolean()
				.nullable()
				.describe(
					'Set true when "externalLink" is a variable reference. The "externalLink" value must then be a bare variable name without {{ }}',
				),
			showIfKey: z.string().nullable(),
			aliasFor: z
				.string()
				.nullable()
				.describe(
					"Alias for the variable name like payload.items.variableName. Required only when variable is used inside the repeat node.",
				),
		}),
	});
}

function createMailyLogoSchema() {
	return z.object({
		type: z.enum(["logo"]),
		attrs: z.object({
			src: z.string().describe("Logo image URL"),
			isSrcVariable: z.boolean().nullable(),
			alt: z.string().nullable(),
			title: z.string().nullable(),
			size: z
				.enum(["sm", "md", "lg"])
				.nullable()
				.describe("Logo size: sm=40px, md=48px, lg=64px"),
			alignment: z.enum(["left", "center", "right"]).nullable(),
			showIfKey: z.string().nullable(),
			aliasFor: z
				.string()
				.nullable()
				.describe(
					"Alias for the variable name like payload.items.variableName. Required only when variable is used inside the repeat node.",
				),
		}),
	});
}

function createMailyFooterSchema({ plainText = false } = {}) {
	return z.object({
		type: z.enum(["footer"]),
		attrs: z
			.object({
				textAlign: z.enum(["left", "center", "right"]).nullable(),
				showIfKey: z.string().nullable(),
			})
			.nullable(),
		content: z.array(createMailyInlineContentSchema({ plainText })).nullable(),
	});
}

function createMailyBlockquoteSchema({ plainText = false } = {}) {
	return z.object({
		type: z.enum(["blockquote"]),
		content: z.array(createMailyParagraphSchema({ plainText })).nullable(),
	});
}

function createMailyListItemSchema({ plainText = false } = {}) {
	return z.object({
		type: z.enum(["listItem"]),
		content: z.array(createMailyParagraphSchema({ plainText })).nullable(),
	});
}

function createMailyOrderedListSchema({ plainText = false } = {}) {
	return z.object({
		type: z.enum(["orderedList"]),
		content: z.array(createMailyListItemSchema({ plainText })).nullable(),
	});
}

function createMailyBulletListSchema({ plainText = false } = {}) {
	return z.object({
		type: z.enum(["bulletList"]),
		content: z.array(createMailyListItemSchema({ plainText })).nullable(),
	});
}

function createMailyLinkCardSchema() {
	return z.object({
		type: z.enum(["linkCard"]),
		attrs: z.object({
			title: z.string().describe("Card title"),
			description: z.string().nullable().describe("Card description"),
			link: z.string().describe("Card link URL"),
			linkTitle: z.string().nullable().describe("Link text displayed"),
			image: z.string().nullable().describe("Card image URL"),
			badgeText: z.string().nullable().describe("Badge text overlay"),
			subTitle: z.string().nullable(),
		}),
	});
}

function createMailyLeafNodeSchema({ plainText = false } = {}) {
	return z.discriminatedUnion("type", [
		createMailyLinkCardSchema(),
		createMailyDividerSchema(),
		createMailySpacerSchema(),
		createMailyButtonSchema(),
		createMailyImageSchema(),
		createMailyInlineImageSchema(),
		createMailyParagraphSchema({ plainText }),
		createMailyHeadingSchema({ plainText }),
		createMailyLogoSchema(),
	]);
}

function createMailySectionAttrsSchema() {
	return z
		.object({
			backgroundColor: z.string().nullable(),
			background: z.string().nullable(),
			borderRadius: z.number().nullable(),
			borderWidth: z.number().nullable(),
			borderColor: z.string().nullable(),
			borderStyle: z.enum(["solid", "dashed", "dotted"]).nullable(),
			paddingTop: z.number().nullable(),
			paddingRight: z.number().nullable(),
			paddingBottom: z.number().nullable(),
			paddingLeft: z.number().nullable(),
			marginTop: z.number().nullable(),
			marginRight: z.number().nullable(),
			marginBottom: z.number().nullable(),
			marginLeft: z.number().nullable(),
			align: z.enum(["left", "center", "right"]).nullable(),
			textAlign: z.enum(["left", "center", "right"]).nullable(),
			showIfKey: z.string().nullable(),
		})
		.nullable();
}

function createMailyRepeatAttrsSchema() {
	return z
		.object({
			each: z
				.string()
				.nullable()
				.describe("Variable name for the array to iterate over"),
			iterations: z
				.number()
				.nullable()
				.describe("Number of iterations (0 = all)"),
			isUpdatingKey: z.boolean().nullable(),
			showIfKey: z.string().nullable(),
		})
		.nullable();
}

function createMailyRepeatSchema({ plainText = false } = {}) {
	return z.object({
		type: z.enum(["repeat"]),
		attrs: createMailyRepeatAttrsSchema(),
		content: z.array(createMailyLeafNodeSchema({ plainText })).nullable(),
	});
}

function createMailySectionContentSchema({ plainText = false } = {}) {
	return z.discriminatedUnion("type", [
		createMailyParagraphSchema({ plainText }),
		createMailyHeadingSchema({ plainText }),
		createMailyButtonSchema(),
		createMailySpacerSchema(),
		createMailyDividerSchema(),
		createMailyImageSchema(),
		createMailyInlineImageSchema(),
		createMailyLogoSchema(),
		createMailyLinkCardSchema(),
		createMailyRepeatSchema({ plainText }),
	]);
}

function createMailySectionSchema({ plainText = false } = {}) {
	return z.object({
		type: z.enum(["section"]),
		attrs: createMailySectionAttrsSchema(),
		content: z.array(createMailySectionContentSchema({ plainText })).nullable(),
	});
}

function createMailyHtmlCodeBlockSchema() {
	return z.object({
		type: z.enum(["htmlCodeBlock"]),
		content: z.array(createMailyTextNodeSchema()).nullable(),
	});
}

function createMailyNodeSchema() {
	const plainText = { plainText: true };

	return z.discriminatedUnion("type", [
		createMailyParagraphSchema(),
		createMailyHeadingSchema(),
		createMailyButtonSchema(),
		createMailySpacerSchema(),
		createMailyDividerSchema(),
		createMailyImageSchema(),
		createMailyLogoSchema(),
		createMailyLinkCardSchema(),
		createMailyHtmlCodeBlockSchema(),
		createMailyFooterSchema(),
		createMailyBlockquoteSchema(),
		createMailyOrderedListSchema(plainText),
		createMailyBulletListSchema(plainText),
		createMailySectionSchema(plainText),
		createMailyRepeatSchema(plainText),
	]);
}

export const mailyBodySchema = z.object({
	type: z.enum(["doc"]).describe('Document type, always "doc"'),
	content: z
		.array(createMailyNodeSchema())
		.describe("Array of content nodes that make up the email body"),
});
