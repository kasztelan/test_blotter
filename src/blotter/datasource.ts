import { Lambda, observable } from 'mobx';
import {GridApi, IViewportDatasource, IViewportDatasourceParams} from 'ag-grid'
import { IChangedData, IDataProvider, IViewportChangedData } from './data-provider';
import { ViewModel } from './view-model';

export class Datasource implements IViewportDatasource {
  private params!: IViewportDatasourceParams;
  private dataProvider: IDataProvider;
  private reactionDisposer?: Lambda;
  private gridApi: GridApi;

  @observable public lastUpdateDataStartRow = 0;
  @observable public lastData: any[] = [];

  constructor(dataProvider: IDataProvider, gridApi: GridApi) {
    this.dataProvider = dataProvider;
    this.dataProvider.dataChanged.subscribe(this.updateData);
    this.dataProvider.viewportChanged$.subscribe(this.updateViewport);

    this.gridApi = gridApi;
  }

  private updateViewport = (viewportChange: IViewportChangedData) => {
    const rowModel = (this.gridApi as any).rowModel;
    const viewport = (this.gridApi as any).gridPanel.eBodyViewport;
    viewport.scrollTo(0, viewport.scrollTop + viewportChange.rowOffset * rowModel.rowHeight);
  }

  private updateData = (response: IChangedData) => {
    this.lastUpdateDataStartRow = response.startRow;
    this.lastData = response.data;
    console.log('DATASOURCE: update data', {data: response.data, startRow: response.startRow});

    const ordersData: any = {};
    response.data.forEach((value: ViewModel, index: number) => {
      ordersData[index + response.startRow] = value;
    });

    this.params.setRowData(ordersData);
  }

  public init = (params: IViewportDatasourceParams) => {
    this.params = params;
    this.params.setRowCount(1000);
  }

  public setViewportRange = (startRow: number, endRow: number) => {
    console.log('DATASOURCE: set viewport', {startRow, endRow});
    this.dataProvider.setRange(startRow, endRow);
  }

  public destroy = () => {
    this.reactionDisposer!();
  }

  public getChildren = (orderId: string) => {
    this.dataProvider.getChildren(orderId);
  }

  public removeChildren = (orderId: string) => {
    this.dataProvider.removeChildren(orderId);
  }
}