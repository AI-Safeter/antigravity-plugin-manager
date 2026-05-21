---
name: nestjs-patterns
description: Build NestJS applications with modules, providers, controllers, and the request lifecycle (Guards, Interceptors, Pipes, Filters). Use when scaffolding modules, wiring DI, adding validation with class-validator, integrating TypeORM or Prisma, or deciding global vs feature scope.
---

# NestJS Patterns

NestJS structures Node servers around **modules** that group **providers** (services) and **controllers** (HTTP/RPC handlers) and link them via a declarative DI container. The request pipeline runs Middleware -> Guards -> Interceptors (pre) -> Pipes -> Handler -> Interceptors (post) -> Exception Filters. This skill covers module composition, the four cross-cutting building blocks, validation, and ORM integration.

## Use this skill when

- Scaffolding a new NestJS module, controller, or service
- Wiring dependency injection and choosing provider scope
- Adding validation, transformation, or DTOs with `class-validator` / `class-transformer`
- Implementing auth via Guards, logging via Interceptors, or global error handling via Filters
- Integrating TypeORM, Prisma, or another data layer module
- Deciding between a global module and a re-exported feature module

## Do not use this skill when

- The project uses a different Node framework (Express, Fastify standalone, Hono)
- You need deep frontend or framework-agnostic Node guidance
- The question is about a non-Nest microservice transport you have not configured

## Core concepts

- **Module**: a class with `@Module({ imports, controllers, providers, exports })`. Modules form a tree; only `exports`-ed providers are visible to importing modules.
- **Provider**: anything injectable -- typically a `@Injectable()` class. Registered in `providers`; resolved by type token or string/symbol token via `@Inject()`.
- **Controller**: `@Controller('path')` class with route methods decorated by `@Get()`, `@Post()`, etc. Pulls params via `@Param`, `@Query`, `@Body`, `@Headers`, `@Req`.
- **DI scopes**: `DEFAULT` (singleton, default), `REQUEST` (new instance per request, carries `REQUEST` context), `TRANSIENT` (new instance per consumer). Request-scoped providers cascade -- everything that depends on them also becomes request-scoped, which has performance cost.
- **Request lifecycle** (in order): Middleware -> Guards -> Interceptors (before) -> Pipes -> Handler -> Interceptors (after, via `tap`/`map`) -> Exception Filters (on throw).
- **Global modules**: `@Global()` plus exporting providers makes them available app-wide without re-importing. Use sparingly -- typically for `ConfigModule`, `LoggerModule`.

## Quick start

```ts
// users.module.ts
import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

```ts
// users.controller.ts
import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common'
import { AuthGuard } from '../auth/auth.guard'
import { CreateUserDto } from './dto/create-user.dto'
import { UsersService } from './users.service'

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.users.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto)
  }
}
```

```ts
// dto/create-user.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator'

export class CreateUserDto {
  @IsEmail() email!: string
  @IsString() @MinLength(2) name!: string
}
```

```ts
// main.ts -- enable global validation pipe
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  await app.listen(3000)
}
bootstrap()
```

## Key patterns

- **Guards** for authorization: implement `CanActivate`, return boolean/Promise/Observable. Apply via `@UseGuards()` on controller/method or `app.useGlobalGuards()`.
- **Interceptors** for cross-cutting concerns: logging, caching, response shaping, timeouts. Implement `NestInterceptor` and use RxJS operators on the `next.handle()` stream.
- **Pipes** for validation and transformation: `ValidationPipe` runs class-validator on DTOs; `ParseIntPipe`, `ParseUUIDPipe` coerce route params. Build custom pipes by implementing `PipeTransform`.
- **Exception Filters** for consistent error responses: `@Catch(HttpException)` class with `catch(exception, host)`. Register globally with `app.useGlobalFilters()` or via `APP_FILTER` provider token.
- **`APP_*` tokens** keep globals DI-aware: register guards/interceptors/pipes/filters as providers using `APP_GUARD`, `APP_INTERCEPTOR`, `APP_PIPE`, `APP_FILTER`. Unlike `app.useGlobalX`, they get full DI.
- **TypeORM**: `TypeOrmModule.forRoot({...})` at app root, `TypeOrmModule.forFeature([User])` in feature modules. Inject repositories via `@InjectRepository(User)`.
- **Prisma**: wrap `PrismaClient` in an `@Injectable()` `PrismaService extends PrismaClient` with `OnModuleInit` calling `this.$connect()`; export from a `PrismaModule` (often `@Global()`).
- **Feature module vs global**: prefer feature modules with explicit `exports`. Only mark `@Global()` for true infrastructure (config, logger, db) that every module needs.

## Common pitfalls

- **Forgetting to `export` a provider** the consuming module needs. The provider works inside its own module but throws "Nest can't resolve dependencies" elsewhere.
- **Circular module imports**: use `forwardRef(() => OtherModule)` on both sides. Better: extract the shared interface into a third module.
- **Request-scoped contamination**: making a base service `REQUEST`-scoped forces every singleton that depends on it to become request-scoped, which kills connection reuse and request-independent caching.
- **Validation pipe without `transform: true`**: numbers from `@Param`/`@Query` stay strings; DTOs receive plain objects, not class instances, so `class-transformer` defaults and `@Type()` decorators are ignored.
- **`@Body()` without a DTO class**: validation can't run on `any`. Always declare a DTO with `class-validator` decorators.
- **Using `app.useGlobalGuards(new AuthGuard(...))`** when the guard needs DI: it won't receive providers. Use `APP_GUARD` provider token instead.
- **Mixing Express- and Fastify-specific APIs** without choosing an adapter explicitly. Pick one platform (`@nestjs/platform-express` or `@nestjs/platform-fastify`) at app creation.
- **Heavy logic in controllers**: controllers should map HTTP <-> service calls; put business logic in services so it stays testable and reusable across transports.

## Reference

- NestJS docs: https://docs.nestjs.com/
- Fundamentals (DI, scope, lifecycle): https://docs.nestjs.com/fundamentals/custom-providers
- Pipes, Guards, Interceptors, Filters: https://docs.nestjs.com/pipes
- TypeORM integration: https://docs.nestjs.com/techniques/database
- Prisma integration: https://docs.nestjs.com/recipes/prisma
