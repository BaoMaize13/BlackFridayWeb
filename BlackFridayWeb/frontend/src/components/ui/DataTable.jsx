export function DataTable({ columns, rows, getRowKey, emptyState }) {
  if (!rows.length) {
    return emptyState ?? null;
  }

  return (
    <div className="table-shell">
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={getRowKey ? getRowKey(row, index) : index}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {typeof column.render === "function"
                      ? column.render(row, index)
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
