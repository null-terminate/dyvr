import { 
  Project, 
  SourceFolder, 
  View, 
  ScanProgress, 
  ScanResults, 
  ColumnDefinition, 
  QueryModel, 
  QueryResult, 
  MainProcessAPI 
} from './mainProcessTypes';

declare global {
  interface Window {
    api: MainProcessAPI;
  }
}

export {};
