# Contributing to MusicQuest

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Code of Conduct

Be respectful and inclusive. We welcome contributions from everyone.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/musicquest.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes
6. Commit your changes: `git commit -m "Add your feature"`
7. Push to your fork: `git push origin feature/your-feature-name`
8. Create a Pull Request

## Development Setup

```bash
npm install
npm run dev
```

## Code Style

This project uses ESLint and Prettier for code formatting.

### ESLint Configuration
- Follow the existing ESLint configuration
- Run `npm run lint` before committing

### Code Style Guidelines
- Use functional components with hooks
- Use TypeScript/JSX for all React components
- Use descriptive variable and function names
- Add JSDoc comments for complex functions
- Keep functions small and focused
- Use async/await instead of promises chains
- Use meaningful commit messages

### Component Structure
```jsx
import statements

const ComponentName = ({ props }) => {
  // Hooks
  // State
  // Effects
  // Functions
  // Render
};

export default ComponentName;
```

## Testing

- Add unit tests for new utilities
- Test parsers with sample data
- Ensure visualizations render correctly
- Test responsive design on multiple devices

### Running Tests
```bash
npm test
```

## Pull Request Process

1. Update the README.md with details of changes if needed
2. Update documentation for new features
3. Ensure your code follows the style guide
4. Add tests for new functionality
5. Make sure all tests pass
6. Request review from maintainers

### PR Title Format
- `feat: Add new feature`
- `fix: Fix bug in component`
- `docs: Update documentation`
- `style: Format code`
- `refactor: Refactor component`
- `test: Add tests`
- `chore: Update dependencies`

## Issue Templates

### Bug Report
- Description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots if applicable
- Browser and version
- Operating system

### Feature Request
- Description of the feature
- Use case and benefits
- Proposed implementation
- Alternatives considered

## Adding New Visualizations

1. Create new component in `src/components/Timeline/`
2. Add visualization mode to settings
3. Implement D3.js rendering logic
4. Add hover interactions and tooltips
5. Ensure responsive design
6. Update documentation

## API Integration

When adding new API integrations:
- Use the existing rate limiter
- Add retry logic with exponential backoff
- Handle errors gracefully
- Cache responses when appropriate
- Follow API terms of service

## Security

- Never commit API keys or secrets
- Use environment variables for sensitive data
- Sanitize user input with DOMPurify
- Follow OWASP security guidelines
- Report security vulnerabilities privately

## Documentation

- Keep README.md up to date
- Document new features and APIs
- Add JSDoc comments for public functions
- Include code examples where helpful

## Performance

- Optimize D3.js rendering for large datasets
- Use React.memo for expensive components
- Implement virtual scrolling for long lists
- Lazy load visualization components
- Monitor bundle size

## Accessibility

- Use semantic HTML
- Add ARIA labels
- Ensure keyboard navigation works
- Test with screen readers
- Maintain color contrast ratios

## Browser Support

Ensure compatibility with:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Questions?

Feel free to open an issue for any questions about contributing.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Thank You!

Your contributions help make this project better for everyone. We appreciate your time and effort!
