import { describe, expect, it } from "vitest";

import { buildBodyTextClean, sanitizeHtml } from "./html";

describe("sanitizeHtml", () => {
  it("blocks external images and strips scripts", () => {
    const html = `<div>
      <img src="https://tracker.example/pixel" width="1" height="1" />
      <img src="https://cdn.example/logo.png" alt="Logo" />
      <script>alert(1)</script>
      <a href="https://example.com">link</a>
    </div>`;

    const sanitized = sanitizeHtml(html);

    expect(sanitized).not.toMatch(/<script/i);
    expect(sanitized).not.toMatch(/<img/i);
    expect(sanitized).toMatch(/data-mailbox-img/);
    expect(sanitized).toMatch(/target="_blank"/);
    expect(sanitized).toMatch(/rel="noreferrer noopener"/);
  });
});

describe("buildBodyTextClean", () => {
  it("prefers usable plain text", () => {
    const plainText = "Your code is 123456\n\nhttps://example.com/verify";
    return buildBodyTextClean({ plainText, sanitizedHtml: "" }).then((clean) => {
      expect(clean).toMatch(/OTP: 123456/);
      expect(clean).toMatch(/Links: https:\/\/example.com\/verify/);
    });
  });

  it("converts html and removes common footers", async () => {
    const html = `<p>Verify your login</p>
      <p>Code: <b>654321</b></p>
      <p>Unsubscribe</p>
      <p>All rights reserved</p>`;

    const sanitized = sanitizeHtml(html);
    const clean = await buildBodyTextClean({ plainText: "", sanitizedHtml: sanitized });

    expect(clean).toMatch(/OTP: 654321/);
    expect(clean).toContain("Verify your login");
    expect(clean).not.toMatch(/Unsubscribe/i);
    expect(clean).not.toMatch(/rights reserved/i);
  });
});
