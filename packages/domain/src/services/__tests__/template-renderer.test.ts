import { describe, it, expect } from 'vitest';
import { TemplateRenderer } from '../template-renderer.js';

describe('TemplateRenderer', () => {
  describe('renderTemplate', () => {
    it('should correctly replace placeholders with provided values', () => {
      const template = 'Olá, {{ name }}! Seu pedido {{ orderId }} foi aprovado.';
      const data = {
        name: 'João',
        orderId: '12345',
      };
      const result = TemplateRenderer.renderTemplate(template, data);
      expect(result).toBe('Olá, João! Seu pedido 12345 foi aprovado.');
    });

    it('should handle placeholders without spaces', () => {
      const template = 'Link: {{url}}';
      const data = { url: 'https://example.com' };
      const result = TemplateRenderer.renderTemplate(template, data);
      expect(result).toBe('Link: https://example.com');
    });

    it('should ignore placeholders that are not provided in data', () => {
      const template = '{{ field1 }} e {{ field2 }}';
      const data = { field1: 'Valor1' };
      const result = TemplateRenderer.renderTemplate(template, data);
      expect(result).toBe('Valor1 e {{ field2 }}');
    });

    it('should replace multiple instances of the same placeholder', () => {
      const template = 'O valor {{ value }} é igual a {{value}}?';
      const data = { value: '10' };
      const result = TemplateRenderer.renderTemplate(template, data);
      expect(result).toBe('O valor 10 é igual a 10?');
    });
  });

  describe('validateTemplatePlaceholders', () => {
    it('should return valid=true when all mandatory placeholders are present', () => {
      const template = 'Obrigado, {{ nome }}! Sua cotação {{ cotacao }} foi recebida.';
      const mandatory = ['nome', 'cotacao'];
      const result = TemplateRenderer.validateTemplatePlaceholders(template, mandatory);
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should return valid=false and list missing placeholders', () => {
      const template = 'Nova cotação {{ cotacao }}';
      const mandatory = ['cotacao', 'link', 'fornecedor'];
      const result = TemplateRenderer.validateTemplatePlaceholders(template, mandatory);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['link', 'fornecedor']);
    });

    it('should handle empty mandatory array', () => {
      const template = 'Apenas texto sem variáveis.';
      const mandatory: string[] = [];
      const result = TemplateRenderer.validateTemplatePlaceholders(template, mandatory);
      expect(result.valid).toBe(true);
    });
  });
});
