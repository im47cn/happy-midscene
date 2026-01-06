/**
 * Unit tests for response parser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getResponseParser, resetResponseParser } from '../responseParser';
import type { ParsedResponse } from '../../../types/debugAssistant';

describe('ResponseParser', () => {
  beforeEach(() => {
    resetResponseParser();
  });

  describe('parse', () => {
    it('should parse plain text response', () => {
      const parser = getResponseParser();
      const response = 'This is a simple text response.';

      const result = parser.parse(response);

      expect(result.text).toBe(response);
      expect(result.actions).toEqual([]);
      expect(result.suggestions).toEqual([]);
      expect(result.contextRequest).toBeNull();
    });

    it('should parse ACTION tags', () => {
      const parser = getResponseParser();
      const response = 'Let me click the button for you.\n[ACTION:click:submit-button]';

      const result = parser.parse(response);

      expect(result.text).toContain('click the button');
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe('click');
      expect(result.actions[0].target).toBe('submit-button');
    });

    it('should parse multiple ACTION tags', () => {
      const parser = getResponseParser();
      const response = `
[ACTION:click:button1]
[ACTION:input:username:testuser]
[ACTION:screenshot]
`;

      const result = parser.parse(response);

      expect(result.actions).toHaveLength(3);
      expect(result.actions[0].type).toBe('click');
      expect(result.actions[1].type).toBe('input');
      expect(result.actions[2].type).toBe('screenshot');
    });

    it('should parse ACTION tag with value parameter', () => {
      const parser = getResponseParser();
      const response = '[ACTION:input:search:query string]';

      const result = parser.parse(response);

      expect(result.actions[0].type).toBe('input');
      expect(result.actions[0].target).toBe('search');
      expect(result.actions[0].value).toBe('query string');
    });

    it('should parse SUGGESTION tags', () => {
      const parser = getResponseParser();
      const response = 'Here is a fix:\n[SUGGESTION:Add explicit wait|await page.waitForSelector("#btn")|0.9]';

      const result = parser.parse(response);

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].description).toBe('Add explicit wait');
      expect(result.suggestions[0].code).toBe('await page.waitForSelector("#btn")');
      expect(result.suggestions[0].confidence).toBe(0.9);
    });

    it('should parse SUGGESTION without confidence', () => {
      const parser = getResponseParser();
      const response = '[SUGGESTION:Retry the action|retry()]';

      const result = parser.parse(response);

      expect(result.suggestions[0].description).toBe('Retry the action');
      expect(result.suggestions[0].code).toBe('retry()');
      expect(result.suggestions[0].confidence).toBe(0.7); // default
    });

    it('should parse SUGGESTION without code', () => {
      const parser = getResponseParser();
      const response = '[SUGGESTION:Wait for the element to load]';

      const result = parser.parse(response);

      expect(result.suggestions[0].description).toBe('Wait for the element to load');
      expect(result.suggestions[0].code).toBe('');
    });

    it('should parse CONTEXT tags', () => {
      const parser = getResponseParser();
      const response = '[CONTEXT:console_errors]';

      const result = parser.parse(response);

      expect(result.contextRequest).not.toBeNull();
      expect(result.contextRequest?.type).toBe('console_errors');
    });

    it('should parse CONTEXT with details', () => {
      const parser = getResponseParser();
      const response = '[CONTEXT:network_errors:last 10 requests]';

      const result = parser.parse(response);

      expect(result.contextRequest?.type).toBe('network_errors');
      expect(result.contextRequest?.details).toBe('last 10 requests');
    });

    it('should parse mixed response', () => {
      const parser = getResponseParser();
      const response = `
The issue is that the element is not visible yet.

[ACTION:screenshot]
[SUGGESTION:Add wait before click|await page.waitForSelector("#btn")]

Let me take a screenshot first.
[ACTION:highlight:button]
`;

      const result = parser.parse(response);

      expect(result.text).toContain('not visible yet');
      expect(result.text).toContain('Let me take a screenshot');
      expect(result.actions).toHaveLength(2);
      expect(result.suggestions).toHaveLength(1);
    });

    it('should strip tags from text output', () => {
      const parser = getResponseParser();
      const response = 'Before [ACTION:click:btn] after [SUGGESTION:wait] end';

      const result = parser.parse(response);

      expect(result.text).not.toContain('[ACTION:');
      expect(result.text).not.toContain('[SUGGESTION:');
      expect(result.text).toBe('Before  after  end');
    });
  });

  describe('parseAction', () => {
    it('should extract action type and target', () => {
      const parser = getResponseParser();

      const action = parser.parseAction('[ACTION:click:submit-button]');

      expect(action).not.toBeNull();
      expect(action?.type).toBe('click');
      expect(action?.target).toBe('submit-button');
    });

    it('should extract action value', () => {
      const parser = getResponseParser();

      const action = parser.parseAction('[ACTION:scroll:down:500]');

      expect(action?.value).toBe('500');
    });

    it('should handle spaces in action tag', () => {
      const parser = getResponseParser();

      const action = parser.parseAction('[ACTION: click : button ]');

      expect(action?.type).toBe('click');
      expect(action?.target).toBe('button');
    });

    it('should return null for invalid format', () => {
      const parser = getResponseParser();

      const action = parser.parseAction('[INVALID:format]');

      expect(action).toBeNull();
    });

    it('should return null for malformed tag', () => {
      const parser = getResponseParser();

      const action = parser.parseAction('[ACTION:click]'); // missing target

      expect(action).toBeNull();
    });
  });

  describe('parseSuggestion', () => {
    it('should extract suggestion components', () => {
      const parser = getResponseParser();

      const suggestion = parser.parseSuggestion(
        '[SUGGESTION:Add wait|await page.waitFor()|0.85]',
      );

      expect(suggestion).not.toBeNull();
      expect(suggestion?.description).toBe('Add wait');
      expect(suggestion?.code).toBe('await page.waitFor()');
      expect(suggestion?.confidence).toBe(0.85);
    });

    it('should handle suggestion without code', () => {
      const parser = getResponseParser();

      const suggestion = parser.parseSuggestion('[SUGGESTION:Just retry]');

      expect(suggestion?.description).toBe('Just retry');
      expect(suggestion?.code).toBe('');
      expect(suggestion?.confidence).toBe(0.7);
    });

    it('should handle suggestion with pipe in code', () => {
      const parser = getResponseParser();

      const suggestion = parser.parseSuggestion(
        '[SUGGESTION:Use selector|element.querySelector("a | b")|0.8]',
      );

      expect(suggestion?.code).toBe('element.querySelector("a | b")');
    });

    it('should return null for invalid format', () => {
      const parser = getResponseParser();

      const suggestion = parser.parseSuggestion('[INVALID:format]');

      expect(suggestion).toBeNull();
    });
  });

  describe('parseContextRequest', () => {
    it('should extract context type', () => {
      const parser = getResponseParser();

      const request = parser.parseContextRequest('[CONTEXT:console_errors]');

      expect(request).not.toBeNull();
      expect(request?.type).toBe('console_errors');
    });

    it('should extract context details', () => {
      const parser = getResponseParser();

      const request = parser.parseContextRequest('[CONTEXT:network_errors:filter by status]');

      expect(request?.details).toBe('filter by status');
    });

    it('should return null for invalid format', () => {
      const parser = getResponseParser();

      const request = parser.parseContextRequest('[INVALID:format]');

      expect(request).toBeNull();
    });
  });

  describe('parseActions', () => {
    it('should parse multiple actions', () => {
      const parser = getResponseParser();

      const actions = parser.parseActions(
        '[ACTION:click:btn1]\nText\n[ACTION:input:field:value]',
      );

      expect(actions).toHaveLength(2);
      expect(actions[0].type).toBe('click');
      expect(actions[1].type).toBe('input');
    });

    it('should return empty array for no actions', () => {
      const parser = getResponseParser();

      const actions = parser.parseActions('No actions here');

      expect(actions).toEqual([]);
    });
  });

  describe('parseSuggestions', () => {
    it('should parse multiple suggestions', () => {
      const parser = getResponseParser();

      const suggestions = parser.parseSuggestions(
        '[SUGGESTION:Fix1|code1]\n[ACTION:click:btn]\n[SUGGESTION:Fix2|code2]',
      );

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].description).toBe('Fix1');
      expect(suggestions[1].description).toBe('Fix2');
    });

    it('should return empty array for no suggestions', () => {
      const parser = getResponseParser();

      const suggestions = parser.parseSuggestions('No suggestions here');

      expect(suggestions).toEqual([]);
    });
  });

  describe('stripTags', () => {
    it('should remove ACTION tags', () => {
      const parser = getResponseParser();

      const result = parser.stripTags('Text [ACTION:click:btn] more');

      expect(result).toBe('Text  more');
    });

    it('should remove SUGGESTION tags', () => {
      const parser = getResponseParser();

      const result = parser.stripTags('Text [SUGGESTION:wait] more');

      expect(result).toBe('Text  more');
    });

    it('should remove CONTEXT tags', () => {
      const parser = getResponseParser();

      const result = parser.stripTags('Text [CONTEXT:errors] more');

      expect(result).toBe('Text  more');
    });

    it('should remove all tag types', () => {
      const parser = getResponseParser();

      const result = parser.stripTags(
        '[ACTION:click] [SUGGESTION:wait] [CONTEXT:errors]',
      );

      expect(result).toBe('  ');
    });
  });
});
