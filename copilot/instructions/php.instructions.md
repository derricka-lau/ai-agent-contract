---
applyTo: "*.php"
---

# PHP / CakePHP conventions

## Testing
- Use `assertSame()` over `assertTrue($x === 'y')` — strict equality, not loose.
- Use `assertArrayHasKey()` over `assertTrue(isset($arr['key']))`.
- Extend `BaseAdminTestCase` or `BaseApiTestCase` for controller tests, not raw `IntegrationTestTrait`.
- Always set up CSRF/security tokens for POST request tests.
- Verify both HTTP response and database state in integration tests.

## Code style
- Follow PSR-12. Use strict types: `declare(strict_types=1)`.
- Use CakePHP conventions: Table classes for queries, Entity classes for domain logic, virtual properties for computed fields.
- Prefer `TableRegistry::getTableLocator()->get()` over direct instantiation.
- Use CakePHP's built-in validation and build rules over manual checks.

## Commands
- Test: `composer test` or `./vendor/bin/phpunit`
- Single test: `./vendor/bin/phpunit tests/TestCase/Path/ToTest.php`
- Lint: `composer cs-check` or `./vendor/bin/phpcs`
- Fix: `composer cs-fix` or `./vendor/bin/phpcbf`
- Static analysis: `composer stan` or `./vendor/bin/phpstan analyse`
