import { fireEvent, render, screen, within } from '@testing-library/react';
import { DataTable, type ColumnDef } from '../data-table';

interface Row {
  id: string;
  name: string;
  score: number | null;
  note?: string;
}

const columns: ColumnDef<Row>[] = [
  { key: 'id', header: 'ID', sortable: true },
  { key: 'name', header: 'Name', sortable: true },
  {
    key: 'score', header: 'Score', sortable: true, align: 'right', hideOnMobile: true,
    accessor: (row) => row.score,
    render: (row) => row.score === null ? 'missing' : row.score.toFixed(1),
  },
  { key: 'note', header: 'Note', className: 'note-cell', headerClassName: 'note-heading' },
];

const rows: Row[] = [
  { id: 'A', name: 'Alpha', score: 20, note: 'First row' },
  { id: 'B', name: 'Beta', score: null },
  { id: 'C', name: 'Charlie', score: 10, note: 'Third row' },
  { id: 'D', name: 'Delta', score: null },
];

describe('DataTable', () => {
  it('searches fallback column values, sorts values, renders optional cells, and reports row clicks', () => {
    const onRowClick = jest.fn();
    render(
      <DataTable
        data={rows}
        columns={columns}
        searchable
        searchPlaceholder="Search rows"
        onRowClick={onRowClick}
        rowClassName={(row) => row.id === 'A' ? 'highlighted-row' : ''}
        defaultSort={{ key: 'score', direction: 'asc' }}
        getRowKey={(row) => row.id}
      />,
    );

    let bodyRows = screen.getAllByRole('row').slice(1);
    expect(bodyRows.map((row) => row.firstChild?.textContent)).toEqual(['C', 'A', 'B', 'D']);
    expect(screen.getAllByText('missing')).toHaveLength(2);
    expect(screen.getAllByText('-')).toHaveLength(2);
    expect(bodyRows.find((row) => row.textContent?.includes('Alpha'))).toHaveClass('highlighted-row');
    fireEvent.click(bodyRows.find((row) => row.textContent?.includes('Alpha')) as HTMLTableRowElement);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);

    fireEvent.click(screen.getByRole('columnheader', { name: /Score/ }));
    bodyRows = screen.getAllByRole('row').slice(1);
    expect(bodyRows.map((row) => row.firstChild?.textContent)).toEqual(['A', 'C', 'B', 'D']);
    fireEvent.click(screen.getByRole('columnheader', { name: /Score/ }));
    bodyRows = screen.getAllByRole('row').slice(1);
    expect(bodyRows.map((row) => row.firstChild?.textContent)).toEqual(['A', 'B', 'C', 'D']);

    fireEvent.change(screen.getByPlaceholderText('Search rows'), { target: { value: 'first row' } });
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search rows'), { target: { value: 'absent' } });
    expect(screen.getByText('目前無資料')).toBeInTheDocument();
  });

  it('shows loading placeholders and customizable empty results', () => {
    const loading = render(<DataTable data={[]} columns={columns} loading className="extra-class" />);
    expect(loading.container.querySelectorAll('.shimmer')).toHaveLength(5);
    loading.unmount();

    render(
      <DataTable
        data={[]}
        columns={columns}
        emptyIcon={<span>Search icon</span>}
        emptyMessage="Nothing here"
        emptyDescription="Try changing the filters."
        toolbar={<button type="button">Refresh</button>}
      />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Try changing the filters.')).toBeInTheDocument();
    expect(screen.getByText('Search icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('moves through pages, changes page size, and resets to the first page on search', () => {
    const data = Array.from({ length: 23 }, (_, index) => ({
      id: String(index).padStart(2, '0'),
      name: `Stock ${index}`,
      score: index,
    }));
    render(
      <DataTable
        data={data}
        columns={columns}
        searchable
        pageSize={10}
        pageSizeOptions={[10, 20]}
        defaultSort={{ key: 'id', direction: 'asc' }}
      />,
    );

    expect(document.body.textContent).toContain('共 23 筆，第 1/3 頁');
    let controls = screen.getAllByRole('button');
    expect(controls[0]).toBeDisabled();
    expect(controls[1]).toBeDisabled();
    fireEvent.click(controls[2]);
    expect(document.body.textContent).toContain('共 23 筆，第 2/3 頁');
    controls = screen.getAllByRole('button');
    fireEvent.click(controls[1]);
    expect(document.body.textContent).toContain('共 23 筆，第 1/3 頁');
    controls = screen.getAllByRole('button');
    fireEvent.click(controls[3]);
    expect(document.body.textContent).toContain('共 23 筆，第 3/3 頁');
    controls = screen.getAllByRole('button');
    expect(controls[2]).toBeDisabled();
    fireEvent.click(controls[0]);
    expect(document.body.textContent).toContain('共 23 筆，第 1/3 頁');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '20' } });
    expect(document.body.textContent).toContain('共 23 筆，第 1/2 頁');
    fireEvent.click(screen.getAllByRole('button')[2]);
    expect(document.body.textContent).toContain('共 23 筆，第 2/2 頁');
    fireEvent.change(screen.getByPlaceholderText('搜尋...'), { target: { value: 'Stock 1' } });
    expect(document.body.textContent).toContain('共 11 筆，第 1/1 頁');
  });

  it('supports no-sort columns and fallback rendering for rows without a key callback', () => {
    render(
      <DataTable
        data={[{ id: 'one', name: 'One', score: 1 }]}
        columns={[{ key: 'name', header: 'Name', sortable: true }, { key: 'unknown', header: 'Missing' }]}
      />,
    );
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('One')).toBeInTheDocument();
    expect(within(row).getByText('-')).toBeInTheDocument();
    const nameHeader = screen.getByRole('columnheader', { name: /Name/ });
    expect(nameHeader).toHaveClass('cursor-pointer');
    fireEvent.click(nameHeader);
    fireEvent.click(nameHeader);
    fireEvent.click(nameHeader);
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });
});
