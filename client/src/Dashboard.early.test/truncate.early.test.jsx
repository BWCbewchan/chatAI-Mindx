

// Import the function to be tested
describe('truncate() truncate method', () => {
  // Happy paths
  describe('Happy paths', () => {
    test('should return the original text if it is shorter than the specified length', () => {
      const text = 'Short text';
      const result = truncate(text, 20);
      expect(result).toBe('Short text');
    });

    test('should truncate text and append an ellipsis if it exceeds the specified length', () => {
      const text = 'This is a long text that needs to be truncated';
      const result = truncate(text, 10);
      expect(result).toBe('This is a l…');
    });

    test('should handle default length of 140 when no length is specified', () => {
      const text = 'This is a long text that needs to be truncated';
      const result = truncate(text);
      expect(result).toBe('This is a long text that needs to be truncated');
    });

    test('should trim whitespace from the text before truncating', () => {
      const text = '   Text with leading and trailing spaces   ';
      const result = truncate(text, 10);
      expect(result).toBe('Text with …');
    });
  });

  // Edge cases
  describe('Edge cases', () => {
    test('should return an empty string if the input text is null', () => {
      const result = truncate(null, 10);
      expect(result).toBe('');
    });

    test('should return an empty string if the input text is undefined', () => {
      const result = truncate(undefined, 10);
      expect(result).toBe('');
    });

    test('should return an empty string if the input text is an empty string', () => {
      const result = truncate('', 10);
      expect(result).toBe('');
    });

    test('should handle text exactly equal to the specified length without truncating', () => {
      const text = 'Exact length';
      const result = truncate(text, 12);
      expect(result).toBe('Exact length');
    });

    test('should handle text with length of zero', () => {
      const text = 'Non-empty text';
      const result = truncate(text, 0);
      expect(result).toBe('…');
    });

    test('should handle negative length by returning the original text', () => {
      const text = 'Negative length';
      const result = truncate(text, -5);
      expect(result).toBe('Negative length');
    });
  });
});