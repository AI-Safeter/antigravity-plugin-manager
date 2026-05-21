---
name: spring-boot-expert
description: Build and operate Spring Boot 3 services on Java 21. Covers auto-configuration, starters, REST controllers, Spring Data JPA, Jakarta Bean Validation, profiles, Actuator, externalized configuration, and testing with @SpringBootTest plus Testcontainers.
---

# Spring Boot 3 Expert

Spring Boot 3 standardizes on Jakarta EE 9+ (the `jakarta.*` namespace) and Java 17+ as the floor — Java 21 LTS is the recommended target. The framework gives you opinionated auto-configuration on top of Spring Framework 6, a consistent starter dependency model, and a deep operational surface via Actuator. Stay close to those primitives; reach for custom infrastructure only when defaults stop fitting.

## Use this skill when

- Designing a new Spring Boot 3.x service or upgrading from Boot 2.x
- Wiring REST endpoints with `@RestController`, services, and Spring Data repositories
- Adding validation, pagination, exception handling, or transaction boundaries
- Configuring profiles (`application-dev.yml`, `application-prod.yml`) and externalized config
- Exposing Actuator endpoints, metrics (Micrometer), and health checks
- Writing slice tests (`@WebMvcTest`, `@DataJpaTest`) or full integration tests with Testcontainers

## Do not use this skill when

- The project targets Spring (non-Boot) with hand-rolled XML or Java config — auto-configuration assumptions do not apply
- You are using Micronaut, Quarkus, or Helidon — DI and config models differ
- You are operating a legacy Boot 2.x service on `javax.*`; namespace migration must happen first

## Core concepts

- **Auto-configuration**: classes annotated `@AutoConfiguration` (registered via `META-INF/spring/...AutoConfiguration.imports`) wire beans based on classpath and properties. Override by defining your own bean or setting properties.
- **Starters**: curated dependency bundles (`spring-boot-starter-web`, `-data-jpa`, `-security`, `-actuator`, `-validation`, `-webflux`). They pull a coherent set of versions managed by the Boot BOM.
- **Stereotypes**: `@RestController` for HTTP endpoints, `@Service` for business logic, `@Repository` for persistence, `@Component` for everything else. All are picked up by component scanning rooted at the `@SpringBootApplication` class.
- **Spring Data JPA**: extend `JpaRepository<Entity, IdType>` and get CRUD, paging, and derived queries for free. Use `@Query` for JPQL or `nativeQuery = true` for SQL.
- **Validation**: Jakarta Bean Validation (`jakarta.validation.constraints.*`) plus `@Valid` on controller parameters triggers `MethodArgumentNotValidException`, which a `@RestControllerAdvice` should translate to a problem-details response.
- **Profiles**: activate with `spring.profiles.active=prod` or `SPRING_PROFILES_ACTIVE`. Profile-specific files: `application-{profile}.yml`. Beans gated with `@Profile("prod")`.
- **Actuator**: under `/actuator`. Enable selectively with `management.endpoints.web.exposure.include=health,info,metrics,prometheus`.

## Quick start

```java
@SpringBootApplication
public class App {
  public static void main(String[] args) { SpringApplication.run(App.class, args); }
}

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
class UserController {
  private final UserService users;

  @GetMapping("/{id}")
  UserDto get(@PathVariable Long id) { return users.get(id); }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  UserDto create(@Valid @RequestBody CreateUserRequest req) { return users.create(req); }
}

record CreateUserRequest(
  @NotBlank @Email String email,
  @NotBlank @Size(min = 2, max = 80) String name
) {}

@Entity @Table(name = "users")
class User {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) Long id;
  @Column(nullable = false, unique = true) String email;
  @Column(nullable = false) String name;
}

interface UserRepository extends JpaRepository<User, Long> {
  Optional<User> findByEmail(String email);
}
```

```yaml
# application.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/app
    username: app
    password: ${DB_PASSWORD}
  jpa:
    hibernate.ddl-auto: validate
    open-in-view: false
management:
  endpoints.web.exposure.include: health,info,prometheus
  endpoint.health.probes.enabled: true
```

## Key patterns

- **Constructor injection only**. Use `final` fields and a single constructor (or Lombok `@RequiredArgsConstructor`). Avoid `@Autowired` on fields — it hides dependencies and breaks tests.
- **Global exception handler** with `@RestControllerAdvice` returning RFC 7807 problem-detail responses (`ProblemDetail.forStatusAndDetail(...)` — built into Spring 6).
- **Transactional boundaries on services**, not controllers or repositories. Mark read methods `@Transactional(readOnly = true)`; default is required + read-write.
- **Disable Open Session in View** (`spring.jpa.open-in-view=false`). Leaving it on hides lazy-loading bugs that explode under load.
- **Use Flyway or Liquibase** for schema; set `spring.jpa.hibernate.ddl-auto=validate` in non-local profiles. Never `update` or `create-drop` against a real database.
- **Testcontainers for integration tests**: `@SpringBootTest` + `@ServiceConnection` on a `PostgreSQLContainer` (Boot 3.1+) — Boot wires the datasource automatically. Use `@DataJpaTest` for repository slices.

## Common pitfalls

- **`open-in-view` left enabled** causes N+1 queries to materialize during view rendering, masked in tests.
- **`@Transactional` on private methods or self-invocation** is ignored. Spring proxies only intercept external calls to public methods on the bean.
- **`LazyInitializationException`** outside a transaction. Either fetch eagerly with a `JOIN FETCH` JPQL query, use entity graphs, or map to a DTO inside the transaction.
- **Returning JPA entities from controllers** leaks the persistence model and triggers lazy loads during serialization. Always map to DTOs/records.
- **Exposing all Actuator endpoints** (`management.endpoints.web.exposure.include=*`) in production. Restrict to `health,info,prometheus` and secure the rest behind authentication.
- **Mixing `javax.*` and `jakarta.*` imports** when upgrading from Boot 2. Every annotation must move; do not stop halfway.
- **`@MockBean` everywhere in `@SpringBootTest`** rebuilds the context per unique mock set, dramatically slowing tests. Prefer slice tests or shared test configuration.

## Reference

- Spring Boot 3 docs: https://docs.spring.io/spring-boot/index.html
- Spring Framework 6 reference: https://docs.spring.io/spring-framework/reference/
- Spring Data JPA: https://docs.spring.io/spring-data/jpa/reference/
- Testcontainers Spring Boot support: https://java.testcontainers.org/modules/spring_boot/
- Boot 2 to 3 migration: https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.0-Migration-Guide
