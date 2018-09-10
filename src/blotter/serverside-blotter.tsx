import * as React from 'react';
import forEach from 'lodash-es/forEach';
import {observable, action} from 'mobx';
import { ColDef, GridReadyEvent, GridOptions } from 'ag-grid';
import {AgGridReact} from 'ag-grid-react'
import 'ag-grid-enterprise';
import { ViewModel } from './view-model';
import { Datasource } from './datasource';
import { DataProvider } from './data-provider';
import { GroupCellRenderer } from './group-cell-renderer';
import { observer } from 'mobx-react';

@observer
export class ServersideBlotter extends React.Component {
  private columns: ColDef[] = [
    {
      field: 'orderId',
      headerName: 'Order ID',
      cellRendererFramework: GroupCellRenderer,
      cellRendererParams: {
        isGroup: (data: ViewModel) => {
          return data && data.isGroup
        },
        isExpanded: (data: ViewModel) => {
          return data && data.isExpanded
        },
        onExpandCollapseChange: (data: ViewModel, expanded: boolean) => {
          data.setExpanded(expanded);
          if (expanded) {
            this.dataSource.getChildren(data.orderId)
          } else {
            this.dataSource.removeChildren(data.orderId)
          }
        }
      }
    }
  ]

  private dataSource!: Datasource;
  @observable private dataProvider!: DataProvider;

  @action private onGridReady = (params: GridReadyEvent) => {
    this.dataProvider = new DataProvider();
    this.dataSource = new Datasource(this.dataProvider, params.api);
    params.api.setViewportDatasource(this.dataSource);
  }

  private getRowNodeId = (elem: ViewModel) => elem.orderId;

  render() {
    const gridOptions: GridOptions = {
      columnDefs: this.columns,
      getRowNodeId: this.getRowNodeId,
      onGridReady: this.onGridReady,
      rowModelType: 'viewport',
      viewportRowModelPageSize: 1,
      viewportRowModelBufferSize: 0,
      rowBuffer: 0,
      suppressContextMenu: true,
      rowStyle: {position: 'absolute'},
      toolPanelSuppressSideButtons: true
    }
    return (
      <div  style={{
        boxSizing: "border-box",
        height: "100%",
        width: "100%",
        display: "flex"
      }}>
        <div className='ag-theme-balham' style={{
          boxSizing: "border-box",
          height: "100%",
          width: "30%"
        }}>
          <AgGridReact
            gridOptions={gridOptions}
          />
        </div>
        {this.dataProvider !== undefined && <div>
          <div>
            <div><button onClick={() => this.dataProvider.onDataChanged()}>onDataChanged</button></div>
            <div>
              <input onChange={e => this.indexesToRemove = e.target.value}/>
              <button onClick={() => this.dataProvider.mockServer.removeAtIndexes(this.indexesToRemove)}>remove</button>
            </div>
            <div>
              <input onChange={e => this.addName = e.target.value}/>
              <button onClick={() => this.dataProvider.mockServer.addOrder(this.addName)}>add</button>
            </div>
          </div>
          <table>
            <tbody>
              <tr>
                <td>serverViewport</td>
                <td>{this.dataProvider.serverViewportStart}</td>
                <td>{this.dataProvider.serverViewportEnd}</td>
              </tr>
              <tr>
                <td>gridViewport</td>
                <td>{this.dataProvider.gridViewportStart}</td>
                <td>{this.dataProvider.gridViewportEnd}</td>
              </tr>
              <tr>
                <td>virtualViewport</td>
                <td>{this.dataProvider.virtualServerViewportStart}</td>
                <td>{this.dataProvider.virtualServerViewportEnd}</td>
              </tr>
              <tr>
                <td>childrenAbove</td>
                <td>{this.dataProvider.childrenAbove}</td>
              </tr>
              <tr>
                <td>lastUpdateDataStartRow</td>
                <td>{this.dataSource.lastUpdateDataStartRow}</td>
              </tr>
              <tr>
                <td>lastDataSource</td>
                <td>{this.dataProvider.lastDataSouce === 'SERVER' ? <span style={{backgroundColor: "red"}}>SERVER</span> : 'CACHE'}</td>
              </tr>


            </tbody>
          </table>
          {this.test()}
        </div>}
      </div>
    )
  }

  private indexesToRemove!: string;
  private addName!: string;


  private test = () => {
    const elems: any[] = [];
    this.dataProvider.openedGroups.forEach((elem, key) => {
      elems.push((
        <tr key={key}>
          <td>{key}</td>
          <td>{elem.serverIndex}</td>
          <td>{elem.count}</td>
        </tr>
      ))

    })
    return (
      <table>
        <thead>
          <td>orderId</td>
          <td>serverIndex</td>
          <td>count</td>
        </thead>
        <tbody>
          {elems}
        </tbody>
      </table>
    )
  }

}