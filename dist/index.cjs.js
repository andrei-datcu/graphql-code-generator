'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

const graphql = require('graphql');
const visitorPluginCommon = require('@graphql-codegen/visitor-plugin-common');
const autoBind = _interopDefault(require('auto-bind'));
const url = require('url');
const pascalCase = require('pascal-case');
const path = require('path');

function generateQueryVariablesSignature(hasRequiredVariables, operationVariablesTypes) {
    return `variables${hasRequiredVariables ? '' : '?'}: ${operationVariablesTypes}`;
}
function generateQueryKey(node) {
    return `['${node.name.value}', variables]`;
}
function generateQueryKeyMaker(node, operationName, operationVariablesTypes, hasRequiredVariables) {
    const signature = generateQueryVariablesSignature(hasRequiredVariables, operationVariablesTypes);
    return `\nuse${operationName}.getKey = (${signature}) => ${generateQueryKey(node)};\n`;
}

class FetchFetcher {
    constructor(visitor) {
        this.visitor = visitor;
    }
    generateFetcherImplementaion() {
        return `
function fetcher<TData, TVariables>(endpoint: string, requestInit: RequestInit, query: string, variables?: TVariables) {
  return async (): Promise<TData> => {
    const res = await fetch(endpoint, {
      method: 'POST',
      ...requestInit,
      body: JSON.stringify({ query, variables }),
    });

    const json = await res.json();

    if (json.errors) {
      const { message } = json.errors[0];

      throw new Error(message);
    }

    return json.data;
  }
}`;
    }
    generateQueryHook(node, documentVariableName, operationName, operationResultType, operationVariablesTypes, hasRequiredVariables) {
        const variables = generateQueryVariablesSignature(hasRequiredVariables, operationVariablesTypes);
        const hookConfig = this.visitor.queryMethodMap;
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.query.hook);
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.query.options);
        const options = `options?: ${hookConfig.query.options}<${operationResultType}, TError, TData>`;
        return `export const use${operationName} = <
      TData = ${operationResultType},
      TError = unknown
    >(
      dataSource: { endpoint: string, fetchParams?: RequestInit }, 
      ${variables}, 
      ${options}
    ) => 
    ${hookConfig.query.hook}<${operationResultType}, TError, TData>(
      ${generateQueryKey(node)},
      fetcher<${operationResultType}, ${operationVariablesTypes}>(dataSource.endpoint, dataSource.fetchParams || {}, ${documentVariableName}, variables),
      options
    );`;
    }
    generateMutationHook(node, documentVariableName, operationName, operationResultType, operationVariablesTypes) {
        const variables = `variables?: ${operationVariablesTypes}`;
        const hookConfig = this.visitor.queryMethodMap;
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.mutation.hook);
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.mutation.options);
        const options = `options?: ${hookConfig.mutation.options}<${operationResultType}, TError, ${operationVariablesTypes}, TContext>`;
        return `export const use${operationName} = <
      TError = unknown,
      TContext = unknown
    >(
      dataSource: { endpoint: string, fetchParams?: RequestInit }, 
      ${options}
    ) => 
    ${hookConfig.mutation.hook}<${operationResultType}, TError, ${operationVariablesTypes}, TContext>(
      (${variables}) => fetcher<${operationResultType}, ${operationVariablesTypes}>(dataSource.endpoint, dataSource.fetchParams || {}, ${documentVariableName}, variables)(),
      options
    );`;
    }
}

class HardcodedFetchFetcher {
    constructor(visitor, config) {
        this.visitor = visitor;
        this.config = config;
    }
    getEndpoint() {
        try {
            new url.URL(this.config.endpoint);
            return JSON.stringify(this.config.endpoint);
        }
        catch (e) {
            return `${this.config.endpoint} as string`;
        }
    }
    getFetchParams() {
        const fetchParams = {
            method: 'POST',
            ...(this.config.fetchParams || {}),
        };
        return Object.keys(fetchParams)
            .map(key => {
            return `      ${key}: ${JSON.stringify(fetchParams[key])},`;
        })
            .join('\n');
    }
    generateFetcherImplementaion() {
        return `
function fetcher<TData, TVariables>(query: string, variables?: TVariables) {
  return async (): Promise<TData> => {
    const res = await fetch(${this.getEndpoint()}, {
${this.getFetchParams()}
      body: JSON.stringify({ query, variables }),
    });
    
    const json = await res.json();

    if (json.errors) {
      const { message } = json.errors[0];

      throw new Error(message);
    }

    return json.data;
  }
}`;
    }
    generateQueryHook(node, documentVariableName, operationName, operationResultType, operationVariablesTypes, hasRequiredVariables) {
        const variables = generateQueryVariablesSignature(hasRequiredVariables, operationVariablesTypes);
        const hookConfig = this.visitor.queryMethodMap;
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.query.hook);
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.query.options);
        const options = `options?: ${hookConfig.query.options}<${operationResultType}, TError, TData>`;
        return `export const use${operationName} = <
      TData = ${operationResultType},
      TError = unknown
    >(
      ${variables}, 
      ${options}
    ) => 
    ${hookConfig.query.hook}<${operationResultType}, TError, TData>(
      ${generateQueryKey(node)},
      fetcher<${operationResultType}, ${operationVariablesTypes}>(${documentVariableName}, variables),
      options
    );`;
    }
    generateMutationHook(node, documentVariableName, operationName, operationResultType, operationVariablesTypes) {
        const variables = `variables?: ${operationVariablesTypes}`;
        const hookConfig = this.visitor.queryMethodMap;
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.mutation.hook);
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.mutation.options);
        const options = `options?: ${hookConfig.mutation.options}<${operationResultType}, TError, ${operationVariablesTypes}, TContext>`;
        return `export const use${operationName} = <
      TError = unknown,
      TContext = unknown
    >(${options}) => 
    ${hookConfig.mutation.hook}<${operationResultType}, TError, ${operationVariablesTypes}, TContext>(
      (${variables}) => fetcher<${operationResultType}, ${operationVariablesTypes}>(${documentVariableName}, variables)(),
      options
    );`;
    }
}

class GraphQLRequestClientFetcher {
    constructor(visitor) {
        this.visitor = visitor;
    }
    generateFetcherImplementaion() {
        return `
function fetcher<TData, TVariables>(client: GraphQLClient, query: string, variables?: TVariables) {
  return async (): Promise<TData> => client.request<TData, TVariables>(query, variables);
}`;
    }
    generateQueryHook(node, documentVariableName, operationName, operationResultType, operationVariablesTypes, hasRequiredVariables) {
        const variables = generateQueryVariablesSignature(hasRequiredVariables, operationVariablesTypes);
        this.visitor.imports.add(`import { GraphQLClient } from 'graphql-request';`);
        const hookConfig = this.visitor.queryMethodMap;
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.query.hook);
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.query.options);
        const options = `options?: ${hookConfig.query.options}<${operationResultType}, TError, TData>`;
        return `export const use${operationName} = <
      TData = ${operationResultType},
      TError = unknown
    >(
      client: GraphQLClient, 
      ${variables}, 
      ${options}
    ) => 
    ${hookConfig.query.hook}<${operationResultType}, TError, TData>(
      ${generateQueryKey(node)},
      fetcher<${operationResultType}, ${operationVariablesTypes}>(client, ${documentVariableName}, variables),
      options
    );`;
    }
    generateMutationHook(node, documentVariableName, operationName, operationResultType, operationVariablesTypes) {
        const variables = `variables?: ${operationVariablesTypes}`;
        this.visitor.imports.add(`import { GraphQLClient } from 'graphql-request';`);
        const hookConfig = this.visitor.queryMethodMap;
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.mutation.hook);
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.mutation.options);
        const options = `options?: ${hookConfig.mutation.options}<${operationResultType}, TError, ${operationVariablesTypes}, TContext>`;
        return `export const use${operationName} = <
      TError = unknown,
      TContext = unknown
    >(
      client: GraphQLClient, 
      ${options}
    ) => 
    ${hookConfig.mutation.hook}<${operationResultType}, TError, ${operationVariablesTypes}, TContext>(
      (${variables}) => fetcher<${operationResultType}, ${operationVariablesTypes}>(client, ${documentVariableName}, variables)(),
      options
    );`;
    }
}

class CustomMapperFetcher {
    constructor(visitor, customFetcher) {
        this.visitor = visitor;
        if (typeof customFetcher === 'string') {
            customFetcher = { func: customFetcher };
        }
        this._mapper = visitorPluginCommon.parseMapper(customFetcher.func);
        this._lazyVariables = customFetcher.lazyVariables;
    }
    getFetcherFnName() {
        if (this._mapper.isExternal) {
            return this._mapper.type;
        }
        return this._mapper.type;
    }
    generateFetcherImplementaion() {
        if (this._mapper.isExternal) {
            return visitorPluginCommon.buildMapperImport(this._mapper.source, [
                {
                    identifier: this._mapper.type,
                    asDefault: this._mapper.default,
                },
            ], this.visitor.config.useTypeImports);
        }
        return null;
    }
    generateQueryHook(node, documentVariableName, operationName, operationResultType, operationVariablesTypes, hasRequiredVariables) {
        const variables = `variables${hasRequiredVariables ? '' : '?'}: ${operationVariablesTypes}`;
        const hookConfig = this.visitor.queryMethodMap;
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.query.hook);
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.query.options);
        const options = `options?: ${hookConfig.query.options}<${operationResultType}, TError, TData>`;
        return `export const use${operationName} = <
      TData = ${operationResultType},
      TError = unknown
    >(
      ${variables}, 
      ${options}
    ) => 
    ${hookConfig.query.hook}<${operationResultType}, TError, TData>(
      ['${node.name.value}', variables],
      ${this.getFetcherFnName()}<${operationResultType}, ${operationVariablesTypes}>(${documentVariableName}, variables),
      options
    );`;
    }
    generateMutationHook(node, documentVariableName, operationName, operationResultType, operationVariablesTypes) {
        const variables = `variables?: ${operationVariablesTypes}`;
        const hookConfig = this.visitor.queryMethodMap;
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.mutation.hook);
        this.visitor.reactQueryIdentifiersInUse.add(hookConfig.mutation.options);
        const options = `options?: ${hookConfig.mutation.options}<${operationResultType}, TError, ${operationVariablesTypes}, TContext>`;
        const typedFetcher = `${this.getFetcherFnName()}<${operationResultType}, ${operationVariablesTypes}>`;
        const impl = this._lazyVariables
            ? `${typedFetcher}(${documentVariableName})`
            : `(${variables}) => ${typedFetcher}(${documentVariableName}, variables)()`;
        return `export const use${operationName} = <
      TError = unknown,
      TContext = unknown
    >(${options}) => 
    ${hookConfig.mutation.hook}<${operationResultType}, TError, ${operationVariablesTypes}, TContext>(
      ${impl},
      options
    );`;
    }
}

class ReactQueryVisitor extends visitorPluginCommon.ClientSideBaseVisitor {
    constructor(schema, fragments, rawConfig, documents) {
        super(schema, fragments, rawConfig, {
            documentMode: visitorPluginCommon.DocumentMode.string,
        });
        this.rawConfig = rawConfig;
        this.reactQueryIdentifiersInUse = new Set();
        this.queryMethodMap = {
            query: {
                hook: 'useQuery',
                options: 'UseQueryOptions',
            },
            mutation: {
                hook: 'useMutation',
                options: 'UseMutationOptions',
            },
        };
        this._externalImportPrefix = this.config.importOperationTypesFrom ? `${this.config.importOperationTypesFrom}.` : '';
        this._documents = documents;
        this.fetcher = this.createFetcher(rawConfig.fetcher || 'fetch');
        autoBind(this);
    }
    get imports() {
        return this._imports;
    }
    createFetcher(raw) {
        if (raw === 'fetch') {
            return new FetchFetcher(this);
        }
        else if (typeof raw === 'object' && 'endpoint' in raw) {
            return new HardcodedFetchFetcher(this, raw);
        }
        else if (raw === 'graphql-request') {
            return new GraphQLRequestClientFetcher(this);
        }
        return new CustomMapperFetcher(this, raw);
    }
    getImports() {
        const baseImports = super.getImports();
        const hasOperations = this._collectedOperations.length > 0;
        if (!hasOperations) {
            return baseImports;
        }
        return [...baseImports, `import { ${Array.from(this.reactQueryIdentifiersInUse).join(', ')} } from 'react-query';`];
    }
    getFetcherImplementation() {
        return this.fetcher.generateFetcherImplementaion();
    }
    buildOperation(node, documentVariableName, operationType, operationResultType, operationVariablesTypes, hasRequiredVariables) {
        var _a, _b;
        const operationName = this.convertName((_b = (_a = node.name) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : '', {
            suffix: this.config.omitOperationSuffix ? '' : pascalCase.pascalCase(operationType),
            useTypesPrefix: false,
        });
        operationResultType = this._externalImportPrefix + operationResultType;
        operationVariablesTypes = this._externalImportPrefix + operationVariablesTypes;
        if (operationType === 'Query') {
            let query = this.fetcher.generateQueryHook(node, documentVariableName, operationName, operationResultType, operationVariablesTypes, hasRequiredVariables);
            if (this.rawConfig.exposeQueryKeys) {
                query += generateQueryKeyMaker(node, operationName, operationVariablesTypes, hasRequiredVariables);
            }
            return query;
        }
        else if (operationType === 'Mutation') {
            return this.fetcher.generateMutationHook(node, documentVariableName, operationName, operationResultType, operationVariablesTypes);
        }
        else if (operationType === 'Subscription') {
            // eslint-disable-next-line no-console
            console.warn(`Plugin "typescript-react-query" does not support GraphQL Subscriptions at the moment! Ignoring "${node.name.value}"...`);
        }
        return null;
    }
}

const plugin = (schema, documents, config) => {
    const allAst = graphql.concatAST(documents.map(v => v.document));
    const allFragments = [
        ...allAst.definitions.filter(d => d.kind === graphql.Kind.FRAGMENT_DEFINITION).map(fragmentDef => ({
            node: fragmentDef,
            name: fragmentDef.name.value,
            onType: fragmentDef.typeCondition.name.value,
            isExternal: false,
        })),
        ...(config.externalFragments || []),
    ];
    const visitor = new ReactQueryVisitor(schema, allFragments, config, documents);
    const visitorResult = graphql.visit(allAst, { leave: visitor });
    return {
        prepend: [...visitor.getImports(), visitor.getFetcherImplementation()],
        content: [visitor.fragments, ...visitorResult.definitions.filter(t => typeof t === 'string')].join('\n'),
    };
};
const validate = async (schema, documents, config, outputFile) => {
    if (path.extname(outputFile) !== '.ts' && path.extname(outputFile) !== '.tsx') {
        throw new Error(`Plugin "typescript-react-query" requires extension to be ".ts" or ".tsx"!`);
    }
};

exports.ReactQueryVisitor = ReactQueryVisitor;
exports.plugin = plugin;
exports.validate = validate;
//# sourceMappingURL=index.cjs.js.map
