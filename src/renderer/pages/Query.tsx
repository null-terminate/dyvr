import React, { useState, useEffect } from 'react';
import { useMainProcess } from '../context/MainProcessContext';

interface QueryResult {
  columns: string[];
  rows: any[][];
  totalRows: number;
}

interface QueryProps {
  projectId: string;
}

const Query: React.FC<QueryProps> = ({ projectId }) => {
  const [sqlQuery, setSqlQuery] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<QueryResult | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  
  const api = useMainProcess();

  const handleQueryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSqlQuery(e.target.value);
  };

  const handleExecuteQuery = async () => {
    if (!sqlQuery.trim()) {
      setError('Please enter a SQL query');
      return;
    }

    setIsExecuting(true);
    setError(null);
    setResults(null);

    try {
      // Use the projectId prop passed from the parent component
      if (!projectId) {
        throw new Error('Project ID not found');
      }
      
      // Execute the SQL query using the API
      if (api) {
        api.executeSqlQuery(projectId, sqlQuery, [], currentPage, rowsPerPage);
      } else {
        throw new Error('API not available');
      }
      
      if (api) {
        // Listen for the query results
        const handleQueryResults = (queryResult: any) => {
          setResults({
            columns: queryResult.columns,
            rows: queryResult.data,
            totalRows: queryResult.totalCount
          });
          setIsExecuting(false);
          
          // Remove the event listener after receiving the results
          if (api.removeAllListeners) {
            api.removeAllListeners('sql-query-results');
          }
        };
        
        // Listen for errors
        const handleError = (error: { message: string, details?: string }) => {
          setError(`Error executing query: ${error.details || error.message}`);
          setIsExecuting(false);
          
          // Remove the event listeners
          if (api.removeAllListeners) {
            api.removeAllListeners('error');
            api.removeAllListeners('sql-query-results');
          }
        };
        
        // Set up event listeners
        api.onSqlQueryResults(handleQueryResults);
        api.onError(handleError);
      }
      
    } catch (err) {
      setError(`Error executing query: ${err instanceof Error ? err.message : String(err)}`);
      setIsExecuting(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    
    // Execute the query for the new page without resetting the UI state
    if (api && sqlQuery.trim() && projectId) {
      // Show a subtle loading indicator without clearing results
      setIsExecuting(true);
      
      // Execute the query for the new page
      api.executeSqlQuery(projectId, sqlQuery, [], newPage, rowsPerPage);
      
      // Set up event listeners for the new query
      const handleQueryResults = (queryResult: any) => {
        setResults({
          columns: queryResult.columns,
          rows: queryResult.data,
          totalRows: queryResult.totalCount
        });
        setIsExecuting(false);
        
        // Remove the event listener after receiving the results
        if (api.removeAllListeners) {
          api.removeAllListeners('sql-query-results');
        }
      };
      
      const handleError = (error: { message: string, details?: string }) => {
        setError(`Error executing query: ${error.details || error.message}`);
        setIsExecuting(false);
        
        // Remove the event listeners
        if (api.removeAllListeners) {
          api.removeAllListeners('error');
          api.removeAllListeners('sql-query-results');
        }
      };
      
      // Set up event listeners
      api.onSqlQueryResults(handleQueryResults);
      api.onError(handleError);
    }
  };

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setCurrentPage(1); // Reset to first page when changing rows per page
    // In a real implementation, this would re-execute the query with the new rows per page
  };

  // Calculate pagination values
  const totalPages = results ? Math.ceil(results.totalRows / rowsPerPage) : 0;
  const startRow = (currentPage - 1) * rowsPerPage + 1;
  const endRow = Math.min(currentPage * rowsPerPage, results?.totalRows || 0);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      maxHeight: '100vh'
    }}>
      {/* Fixed query section that stays in view */}
      <div style={{ flex: '0 0 auto' }}>
        <h2>SQL Query</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <textarea
            value={sqlQuery}
            onChange={handleQueryChange}
            placeholder="Enter your SQL query here (e.g., SELECT * FROM data WHERE customerCode = 'SONYE')"
            style={{
              width: '100%',
              height: '120px',
              padding: '10px',
              fontFamily: 'monospace',
              fontSize: '14px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              resize: 'vertical'
            }}
          />
          
          <div style={{ marginTop: '10px' }}>
            <button 
              onClick={handleExecuteQuery}
              disabled={isExecuting || !sqlQuery.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isExecuting || !sqlQuery.trim() ? 'not-allowed' : 'pointer',
                opacity: isExecuting || !sqlQuery.trim() ? 0.7 : 1
              }}
            >
              {isExecuting ? 'Executing...' : 'Execute'}
            </button>
          </div>
        </div>
      </div>
      
      {error && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}
      
      {isExecuting && !results && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>Executing query...</p>
          {/* Could add a spinner here */}
        </div>
      )}
      
      {/* Scrollable results section */}
      {results && (
        <div style={{ 
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: 'calc(100vh - 250px)' // Adjust based on the height of your query section
        }}>
          <div style={{ 
            marginBottom: '10px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center'
          }}>
            {isExecuting && (
              <div style={{ 
                position: 'absolute', 
                top: '50%', 
                left: '50%', 
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                padding: '10px 20px',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                zIndex: 10
              }}>
                Loading page {currentPage}...
              </div>
            )}
            <div>
              <strong>Results:</strong> {results.totalRows} rows found
            </div>
            <div>
              <label style={{ marginRight: '10px' }}>
                Rows per page:
                <select 
                  value={rowsPerPage}
                  onChange={handleRowsPerPageChange}
                  style={{ marginLeft: '5px' }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>
          </div>
          
          {totalPages > 1 && (
            <div style={{ 
              marginBottom: '20px', 
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                Showing {startRow} to {endRow} of {results.totalRows} entries
              </div>
              <div>
                <button 
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{ 
                    padding: '5px 10px',
                    marginRight: '5px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  Previous
                </button>
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Show pages around current page
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      style={{
                        padding: '5px 10px',
                        marginRight: '5px',
                        backgroundColor: currentPage === pageNum ? '#3498db' : 'transparent',
                        color: currentPage === pageNum ? 'white' : 'inherit',
                        border: currentPage === pageNum ? 'none' : '1px solid #ddd',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button 
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{ 
                    padding: '5px 10px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
          
          <div style={{ 
            overflowY: 'auto',
            overflowX: 'auto',
            flex: '1 1 auto',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              border: '1px solid #ddd'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  {results.columns.map((column, index) => (
                    <th 
                      key={index}
                      style={{ 
                        padding: '10px', 
                        textAlign: 'left',
                        borderBottom: '2px solid #ddd'
                      }}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.rows.map((row, rowIndex) => (
                  <tr 
                    key={rowIndex}
                    style={{ 
                      backgroundColor: rowIndex % 2 === 0 ? 'white' : '#f9f9f9'
                    }}
                  >
                    {row.map((cell, cellIndex) => (
                      <td 
                        key={cellIndex}
                        style={{ 
                          padding: '8px 10px',
                          borderBottom: '1px solid #ddd'
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
};

export default Query;
