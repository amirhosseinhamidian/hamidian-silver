import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const MODULES_ROOT = join(process.cwd(), 'src', 'modules');
const HTTP_DECORATORS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete']);

function collectControllerFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectControllerFiles(path);
    return entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

function decoratorName(decorator: ts.Decorator): string | undefined {
  const { expression } = decorator;
  if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
    return expression.expression.text;
  }
}

function hasDecorator(node: ts.HasDecorators, name: string): boolean {
  return ts.getDecorators(node)?.some((decorator) => decoratorName(decorator) === name) ?? false;
}

function isPaymentDiscoveryRoute(controller: ts.ClassDeclaration, route: ts.Decorator): boolean {
  const { expression } = route;
  if (decoratorName(route) !== 'Get' || !ts.isCallExpression(expression)) return false;

  const [path] = expression.arguments;
  if (!path || !ts.isStringLiteral(path)) return false;

  return (
    (controller.name?.text === 'PaymentGatewaySettingsController' && path.text === 'gateways') ||
    (controller.name?.text === 'PaymentsController' && path.text === 'card-to-card/settings')
  );
}

function findUncoveredRoutes(file: string, source: string): string[] {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest);
  const uncovered: string[] = [];

  for (const controller of parsed.statements.filter(ts.isClassDeclaration)) {
    if (!hasDecorator(controller, 'Controller')) continue;
    if (hasDecorator(controller, 'RequirePermissions') || hasDecorator(controller, 'Public')) {
      continue;
    }

    const methods = controller.members.filter(ts.isMethodDeclaration);
    if (!methods.some((method) => hasDecorator(method, 'RequirePermissions'))) continue;

    for (const method of methods) {
      const route = ts.getDecorators(method)?.find((decorator) => {
        const name = decoratorName(decorator);
        return name !== undefined && HTTP_DECORATORS.has(name);
      });
      if (!route) continue;

      if (
        hasDecorator(method, 'RequirePermissions') ||
        hasDecorator(method, 'Public') ||
        method.parameters.some((parameter) => hasDecorator(parameter, 'CurrentPrincipal')) ||
        isPaymentDiscoveryRoute(controller, route)
      ) {
        continue;
      }

      const { line } = parsed.getLineAndCharacterOfPosition(route.getStart(parsed));
      uncovered.push(`${file}:${line + 1} ${route.getText(parsed)}`);
    }
  }

  return uncovered;
}

describe('administrative API permission coverage', () => {
  it('marks every endpoint in permission-protected controllers as public or permission-gated', () => {
    const uncovered = collectControllerFiles(MODULES_ROOT).flatMap((file) =>
      findUncoveredRoutes(relative(process.cwd(), file), readFileSync(file, 'utf8')),
    );

    if (uncovered.length > 0) {
      throw new Error(`Endpoints missing @Public or @RequirePermissions:\n${uncovered.join('\n')}`);
    }
    expect(uncovered).toEqual([]);
  });

  it('attributes permissions to the controller or the method that declares them', () => {
    const source = `@Controller('reports')
@RequirePermissions(READ)
class ReportsController {
  @Get()
  list() {}
}

@Controller('settings')
class SettingsController {
  @Get('uncovered')
  uncovered() {}
  @RequirePermissions(WRITE)
  @Post('save')
  save() {}

  @Post('preview')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOkResponse({ type: PreviewDto })
  @RequirePermissions(READ)
  preview() {}

  @Get('summary')
  @Public()
  summary() {}
}`;

    expect(findUncoveredRoutes('example.controller.ts', source)).toEqual([
      "example.controller.ts:10 @Get('uncovered')",
    ]);
  });
});
