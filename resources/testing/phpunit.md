# PHPUnit + Laravel Testing

## Overview

Testing resource for Laravel projects using PHPUnit and Laravel's testing utilities.

## Dependencies

```json
{
  "require-dev": {
    "phpunit/phpunit": "^11.0",
    "mockery/mockery": "^1.6",
    "fakerphp/faker": "^1.23"
  }
}
```

## File Structure

```
app/
├── Models/
│   └── User.php
├── Http/
│   └── Controllers/
│       └── AuthController.php
└── Services/
    └── PaymentService.php

tests/
├── TestCase.php           # Base test class
├── CreatesApplication.php # App bootstrap
├── Unit/
│   ├── Models/
│   │   └── UserTest.php
│   └── Services/
│       └── PaymentServiceTest.php
└── Feature/
    ├── Auth/
    │   └── LoginTest.php
    └── Api/
        └── UserApiTest.php
```

## Configuration

**phpunit.xml:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"
         bootstrap="vendor/autoload.php"
         colors="true">
    <testsuites>
        <testsuite name="Unit">
            <directory>tests/Unit</directory>
        </testsuite>
        <testsuite name="Feature">
            <directory>tests/Feature</directory>
        </testsuite>
    </testsuites>
    <source>
        <include>
            <directory>app</directory>
        </include>
    </source>
    <php>
        <env name="APP_ENV" value="testing"/>
        <env name="DB_CONNECTION" value="sqlite"/>
        <env name="DB_DATABASE" value=":memory:"/>
        <env name="CACHE_DRIVER" value="array"/>
        <env name="QUEUE_CONNECTION" value="sync"/>
        <env name="SESSION_DRIVER" value="array"/>
    </php>
</phpunit>
```

## Commands

| Action | Command |
|--------|---------|
| Run all | `php artisan test` |
| With coverage | `php artisan test --coverage` |
| Specific file | `php artisan test tests/Unit/UserTest.php` |
| Filter method | `php artisan test --filter=test_user_can_login` |
| Parallel | `php artisan test --parallel` |
| Stop on failure | `php artisan test --stop-on-failure` |

## Test Templates

### Unit Test

```php
<?php

namespace Tests\Unit\Services;

use App\Services\PaymentService;
use PHPUnit\Framework\TestCase;

class PaymentServiceTest extends TestCase
{
    private PaymentService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new PaymentService();
    }

    // REQ-XXX: {requirement description}
    public function test_calculates_total_with_tax(): void
    {
        // Arrange
        $amount = 100.00;
        $taxRate = 0.21;

        // Act
        $result = $this->service->calculateTotal($amount, $taxRate);

        // Assert
        $this->assertEquals(121.00, $result);
    }
}
```

### Feature Test (HTTP)

```php
<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    // REQ-XXX: {requirement description}
    public function test_user_can_login_with_valid_credentials(): void
    {
        // Arrange
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => bcrypt('password123'),
        ]);

        // Act
        $response = $this->postJson('/api/login', [
            'email' => 'test@example.com',
            'password' => 'password123',
        ]);

        // Assert
        $response->assertStatus(200)
                 ->assertJsonStructure(['token', 'user']);
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        // Arrange
        User::factory()->create(['email' => 'test@example.com']);

        // Act
        $response = $this->postJson('/api/login', [
            'email' => 'test@example.com',
            'password' => 'wrong-password',
        ]);

        // Assert
        $response->assertStatus(401)
                 ->assertJson(['error' => 'Invalid credentials']);
    }
}
```

## Assertions

**PHPUnit assertions:**
```php
$this->assertEquals($expected, $actual);      // Equality
$this->assertSame($expected, $actual);        // Identical (type + value)
$this->assertTrue($value);                    // Is true
$this->assertFalse($value);                   // Is false
$this->assertNull($value);                    // Is null
$this->assertCount(3, $array);                // Array count
$this->assertContains($item, $array);         // Contains item
$this->assertArrayHasKey('key', $array);      // Has key
$this->assertInstanceOf(User::class, $obj);   // Instance of
$this->assertStringContainsString($needle, $haystack);
```

**Laravel HTTP assertions:**
```php
$response->assertStatus(200);                 // Status code
$response->assertOk();                        // 200
$response->assertCreated();                   // 201
$response->assertNotFound();                  // 404
$response->assertUnauthorized();              // 401
$response->assertForbidden();                 // 403
$response->assertJson(['key' => 'value']);    // JSON contains
$response->assertJsonStructure(['id', 'name']);
$response->assertJsonCount(3, 'items');       // JSON array count
$response->assertRedirect('/dashboard');      // Redirect
$response->assertSessionHas('message');       // Session
$response->assertCookie('token');             // Cookie
```

**Laravel database assertions:**
```php
$this->assertDatabaseHas('users', [
    'email' => 'test@example.com'
]);

$this->assertDatabaseMissing('users', [
    'email' => 'deleted@example.com'
]);

$this->assertDatabaseCount('users', 5);

$this->assertSoftDeleted('users', [
    'id' => $user->id
]);
```

## Database Testing

**RefreshDatabase trait:**
```php
use Illuminate\Foundation\Testing\RefreshDatabase;

class UserTest extends TestCase
{
    use RefreshDatabase;  // Migrates and resets DB each test
}
```

**DatabaseTransactions trait:**
```php
use Illuminate\Foundation\Testing\DatabaseTransactions;

class UserTest extends TestCase
{
    use DatabaseTransactions;  // Wraps test in transaction, rolls back
}
```

## Factories

```php
// Create persisted model
$user = User::factory()->create();

// Create multiple
$users = User::factory()->count(5)->create();

// With attributes
$user = User::factory()->create([
    'email' => 'specific@example.com',
    'role' => 'admin',
]);

// With state
$user = User::factory()->admin()->create();

// With relationships
$user = User::factory()
    ->has(Post::factory()->count(3))
    ->create();

// Make without persisting
$user = User::factory()->make();
```

## Mocking

**Laravel Fakes:**
```php
// Mail
Mail::fake();
// ... trigger action
Mail::assertSent(WelcomeEmail::class);
Mail::assertNotSent(SpamEmail::class);

// Queue
Queue::fake();
// ... trigger action
Queue::assertPushed(ProcessOrder::class);

// Event
Event::fake();
// ... trigger action
Event::assertDispatched(UserCreated::class);

// Notification
Notification::fake();
// ... trigger action
Notification::assertSentTo($user, InvoiceNotification::class);

// Storage
Storage::fake('s3');
// ... trigger action
Storage::disk('s3')->assertExists('file.pdf');

// HTTP Client
Http::fake([
    'api.example.com/*' => Http::response(['data' => 'mocked'], 200),
]);
```

**Mockery:**
```php
use Mockery;

public function test_with_mock(): void
{
    $mock = Mockery::mock(PaymentGateway::class);
    $mock->shouldReceive('charge')
         ->once()
         ->with(100.00)
         ->andReturn(true);

    $this->app->instance(PaymentGateway::class, $mock);

    // ... test code
}

protected function tearDown(): void
{
    Mockery::close();
    parent::tearDown();
}
```

## Authentication

```php
// Act as user
$this->actingAs($user);

// Act as user with guard
$this->actingAs($user, 'api');

// Assert authenticated
$this->assertAuthenticated();

// Assert guest
$this->assertGuest();

// Test with Sanctum
use Laravel\Sanctum\Sanctum;

Sanctum::actingAs($user, ['read', 'write']);
```

## Output Parsing

**PASS (show as 1 line):**
```
TESTS: 42/42 PASS (5.1s)
```

**FAIL (show max 10 lines):**
```
TESTS: 40/42 PASS (5.1s)
FAILED:
- LoginTest::test_user_can_login - Expected 200, got 401
- UserApiTest::test_create_user - Missing required field 'email'
```

**PENDING (show max 5 lines):**
```
TESTS: 30/42 PASS, 12 SKIPPED (3.2s)
```

## Common Patterns

### Testing API Resources

```php
public function test_user_resource_structure(): void
{
    $user = User::factory()->create();

    $response = $this->actingAs($user)
                     ->getJson('/api/user');

    $response->assertOk()
             ->assertJsonStructure([
                 'data' => [
                     'id',
                     'name',
                     'email',
                     'created_at',
                 ]
             ]);
}
```

### Testing Validation

```php
public function test_create_user_requires_email(): void
{
    $response = $this->postJson('/api/users', [
        'name' => 'Test User',
        // email missing
    ]);

    $response->assertStatus(422)
             ->assertJsonValidationErrors(['email']);
}
```

### Testing File Uploads

```php
use Illuminate\Http\UploadedFile;

public function test_user_can_upload_avatar(): void
{
    Storage::fake('avatars');
    $user = User::factory()->create();

    $response = $this->actingAs($user)
                     ->postJson('/api/avatar', [
                         'avatar' => UploadedFile::fake()->image('avatar.jpg')
                     ]);

    $response->assertOk();
    Storage::disk('avatars')->assertExists('avatar.jpg');
}
```

## Gotchas

1. **Use RefreshDatabase for isolated tests** - Prevents data leaking between tests
2. **Fake time with Carbon** - `Carbon::setTestNow(now())` for time-dependent tests
3. **Don't forget Mockery::close()** - Or use `MockeryPHPUnitIntegration` trait
4. **Use assertJson for partial matching** - `assertExactJson` for exact matching
5. **Seed database in setUp if needed** - Or use `@seed` annotation
6. **Test both happy path and edge cases** - Validation errors, not found, unauthorized
