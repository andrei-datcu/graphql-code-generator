import { OperationDefinitionNode } from 'graphql';
import { ReactQueryVisitor } from './visitor';
import { FetcherRenderer } from './fetcher';
export declare class CustomMapperFetcher implements FetcherRenderer {
    private visitor;
    private _mapper;
    constructor(visitor: ReactQueryVisitor, fetcherStr: string);
    getFetcherFnName(): string;
    generateFetcherImplementaion(): string;
    generateQueryHook(node: OperationDefinitionNode, documentVariableName: string, operationName: string, operationResultType: string, operationVariablesTypes: string, hasRequiredVariables: boolean): string;
    generateMutationHook(node: OperationDefinitionNode, documentVariableName: string, operationName: string, operationResultType: string, operationVariablesTypes: string): string;
}
