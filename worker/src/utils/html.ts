import sanitize from "sanitize-html";

export const sanitizeHtml = (html: string): string => {
	return sanitize(html, {
		allowedTags: sanitize.defaults.allowedTags.concat(["img", "style"]),
		allowedAttributes: {
			...sanitize.defaults.allowedAttributes,
			"*": ["style", "class"],
		},
		allowedSchemes: ["http", "https", "mailto", "data"],
	});
};

export const extractText = (html: string): string => {
	return sanitize(html, {
		allowedTags: [],
		allowedAttributes: {},
	});
};
