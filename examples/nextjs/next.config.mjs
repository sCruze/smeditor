/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The workspace packages are shipped as TS source until `pnpm build`
  // produces dist/. Transpiling the whole StarterKit graph keeps
  // `next dev` working without a prior build step.
  transpilePackages: [
    "@smeditor/core",
    "@smeditor/react",
    "@smeditor/starter-kit",
    "@smeditor/extension-bold",
    "@smeditor/extension-italic",
    "@smeditor/extension-underline",
    "@smeditor/extension-strike",
    "@smeditor/extension-heading",
    "@smeditor/extension-paragraph",
    "@smeditor/extension-history",
    "@smeditor/extension-link",
    "@smeditor/extension-blockquote",
    "@smeditor/extension-code-block",
    "@smeditor/extension-hard-break",
    "@smeditor/extension-list-item",
    "@smeditor/extension-bullet-list",
    "@smeditor/extension-ordered-list",
    "@smeditor/extension-task-list",
    "@smeditor/extension-task-item",
    "@smeditor/extension-text-align",
    "@smeditor/extension-clear-formatting",
    "@smeditor/extension-horizontal-rule",
    "@smeditor/extension-image",
    "@smeditor/extension-table",
    "@smeditor/extension-markdown",
    "@smeditor/extension-placeholder",
    "@smeditor/theme-default",
  ],
};

export default nextConfig;
