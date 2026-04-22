export class TemplateRenderer {
  /**
   * Replaces placeholders in the format {{placeholder}} with provided values.
   */
  static renderTemplate(template: string, data: Record<string, string>): string {
    let rendered = template;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, value);
    }
    return rendered;
  }

  /**
   * Validates if all mandatory placeholders are present in the template.
   */
  static validateTemplatePlaceholders(
    template: string,
    mandatory: string[],
  ): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    for (const placeholder of mandatory) {
      const regex = new RegExp(`{{\\s*${placeholder}\\s*}}`);
      if (!regex.test(template)) {
        missing.push(placeholder);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}
