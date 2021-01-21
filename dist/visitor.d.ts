import { ClientSideBaseVisitor, ClientSideBasePluginConfig, LoadedFragment } from '@graphql-codegen/visitor-plugin-common';
import { ReactQueryRawPluginConfig } from './config';
import { OperationDefinitionNode, GraphQLSchema } from 'graphql';
import { Types } from '@graphql-codegen/plugin-helpers';
import { FetcherRenderer } from './fetcher';
export interface ReactQueryPluginConfig extends ClientSideBasePluginConfig {
}
export interface ReactQueryMethodMap {
    query: {
        hook: string;
        options: string;
    };
    mutation: {
        hook: string;
        options: string;
    };
}
export declare class ReactQueryVisitor extends ClientSideBaseVisitor<ReactQueryRawPluginConfig, ReactQueryPluginConfig> {
    protected rawConfig: ReactQueryRawPluginConfig;
    private _externalImportPrefix;
    fetcher: FetcherRenderer;
    reactQueryIdentifiersInUse: Set<string>;
    queryMethodMap: ReactQueryMethodMap;
    constructor(schema: GraphQLSchema, fragments: LoadedFragment[], rawConfig: ReactQueryRawPluginConfig, documents: Types.DocumentFile[]);
    get imports(): Set<string>;
    private createFetcher;
    getImports(): string[];
    getFetcherImplementation(): string;
    protected buildOperation(node: OperationDefinitionNode, documentVariableName: string, operationType: string, operationResultType: string, operationVariablesTypes: string, hasRequiredVariables: boolean): string;
}
