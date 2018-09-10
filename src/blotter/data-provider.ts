import { observable, computed, ObservableMap, action } from 'mobx';

import { Subject } from 'rxjs';
import debounce from 'lodash-es/debounce';
import sortBy from 'lodash-es/sortBy';
import { ViewModel } from './view-model';
import { IndexedMap } from './indexed-map';
import { IAnchorChangeResponse, IChildrenQueryResponse, IDataQueryResponse, MockServer } from './mock-server';

export interface IViewportChangedData {
  rowOffset: number;
}

export interface IChangedData {
  data: ViewModel[];
  startRow: number;
}

export interface IDataProvider {
  dataChanged: Subject<IChangedData>;
  viewportChanged$: Subject<IViewportChangedData>;
  setRange: (startRow: number, endRow: number) => void;
  getChildren: (orderId: string) => void;
  removeChildren: (orderId: string) => void;
}

/**
 * Structure for storing information about expanded groups
 */
export interface IOpenedGroupInfo {
  count: number; // last known number of elements in the group
  serverIndex: number; // last know position of group
}


export class DataProvider implements IDataProvider {
  // stream for propagating changes in dataset
  public dataChanged: Subject<IChangedData>;
  // stream for propagating top anchor index change
  public viewportChanged$: Subject<IViewportChangedData>;

  // structure for storing top level orders
  @observable public topLevelData = new IndexedMap<ViewModel>();
  // structore for storing orders and its children as a flat structure
  @observable public parsedData = new IndexedMap<ViewModel>();

  // last known start row from server
  @observable public serverViewportStart!: number;
  // last known end row from server
  @observable public serverViewportEnd!: number;

  // last known grid viewport start
  @observable public gridViewportStart!: number;
  // last known grid viewport end
  @observable public gridViewportEnd!: number;

  // information about opened groups, needed to calculate proper server index from grid index
  @observable public openedGroups: ObservableMap<string, IOpenedGroupInfo>;

  public mockServer: MockServer;

  constructor() {
    this.mockServer = new MockServer();
    this.mockServer.stream$.subscribe(this.onGetDataResponse);
    this.mockServer.childrenStream$.subscribe(this.onChildrenResponse);
    this.mockServer.onAddRemoveRows$.subscribe(this.onAddRemoveRowsResponse);
    this.mockServer.onAnchorChange$.subscribe(this.onAnchorChange);

    this.dataChanged = new Subject<IChangedData>();
    this.viewportChanged$ = new Subject<IViewportChangedData>();
    this.openedGroups = observable.map<string, IOpenedGroupInfo>();
  }

  /**
   * Number of children in groups opened above current server viewport
   */
  @computed
  public get childrenAbove() {
    let sum = 0;
    this.openedGroups.forEach(value => {
      if( value.serverIndex < this.serverViewportStart!) {
        sum += value.count
      }
    });
    return sum;
  }

  /**
   * Opened groups sorted by the position
   */
  @computed
  public get groupsSortedByIndex() {
    return Array.from(this.openedGroups).map(elem => elem[1]).sort((a, b) => a.serverIndex - b.serverIndex)
  }

  /**
   * Response handler for getting the group children
   */
  @action
  private onChildrenResponse = (response: IChildrenQueryResponse) => {
    const parentOrder = this.topLevelData.get(response.orderId);
    // we can only process the children response if the parent is still visible, if its not the case
    // we ignore the response
    if (parentOrder) {
      // number of children in group
      const count = response.data.length;
      // current server position of the group
      const serverIndex = this.topLevelData.getArray().findIndex(elem => elem.orderId === response.orderId);
      this.openedGroups.set(response.orderId, {count, serverIndex: serverIndex + this.serverViewportStart!});
      // we create children view models and add it to the parent order
      parentOrder.children = observable.array(response.data.map(elem => {
        const viewModel = new ViewModel(elem);
        viewModel.isChildren = true;
        return viewModel;
      }));
      // let listeners know that the data has changed
      this.onDataChanged();
    }
  };

  /**
   * Response handler for top level data
   */
  @action
  private onGetDataResponse = (response: IDataQueryResponse) => {
    console.log('response', response)
    // last response range is what the server is sending updates to, we store it so later we can check
    // if changes viewport changes should trigger another server request
    this.serverViewportStart = response.offset;
    this.serverViewportEnd = response.offset + response.limit;

    const ordersData = response.data.map(elem => elem.action === 'A' && elem.data);
    const data = new IndexedMap<ViewModel>();

    for (let i=0; i<ordersData.length; i++) {
      // if there is already an existing viewmodel we are reusing it instead of creating new one
      let viewModel = this.topLevelData.get(ordersData[i].orderId);
      if (!viewModel) {
        viewModel = this.createTopLevelViewModel(ordersData[i]);
      }

      data.set(ordersData[i].orderId, viewModel);
    }

    // we're replacing the top level data with the one we just got from the server
    this.topLevelData.replace(data);
    this.sortTopLevelData();
    this.recalculateOpenedGroupPositions();
    // let listeners know that the data has changed
    this.onDataChanged();
    this.lastDataSouce = 'SERVER';
  };

  private onAddRemoveRowsResponse = (response: IDataQueryResponse) => {
    console.log('add remove response', response);
    response.data.forEach(elem => {
      if (elem.action === 'A') {
        const viewModel = this.createTopLevelViewModel(elem.data);
        this.topLevelData.set(viewModel.orderId, viewModel)
      } else if (elem.action === 'D') {
        elem.orderIds.forEach(orderId => {
          this.topLevelData.delete(orderId);
          const openedGroup = this.openedGroups.get(orderId);
          if (openedGroup) {
            this.openedGroups.delete(orderId);
          }
        });
      }
    });

    this.sortTopLevelData();
    this.recalculateOpenedGroupPositions();
    this.getDataIfNeeded();
    this.onDataChanged();
  };

  private onAnchorChange = (response: IAnchorChangeResponse) => {
    console.log('anchor change', response);
    this.serverViewportStart += response.anchorOffset;
    this.serverViewportEnd += response.anchorOffset;
    this.viewportChanged$.next({
      rowOffset: response.anchorOffset
    })
  };

  private createTopLevelViewModel = (data: any) => {
    const viewModel = new ViewModel(data);
    const openedGroup = this.openedGroups.get(viewModel.orderId);
    // if this order had opened group before we can create mock view models for children
    // so we can display the expanded group immediately with loading indicator
    if (openedGroup) {
      const mocks: ViewModel[] = [];
      for (let i=0; i< openedGroup.count; i++) {
        const childrenViewModel = new ViewModel();
        childrenViewModel.isLoading = true;
        childrenViewModel.isChildren = true;
        childrenViewModel.orderId = '_mockLoading'; // group cell renderer is using orderId, if we don't set it we won't have loading indicator for some reason, todo investigate
        mocks.push(childrenViewModel)
      }
      viewModel.children = observable.array(mocks);
      // making request for real children data
      this.getChildren(viewModel.orderId);
      viewModel.isExpanded = true;
    }
    return viewModel;
  }

  public onDataChanged = () => {
    this.recalculateParsedData();
    const data = this.parsedData.getArray();
    this.dataChanged.next({data, startRow: this.serverViewportStart + this.childrenAbove});
  };

  private recalculateOpenedGroupPositions = () => {
    this.topLevelData.getArray().forEach((viewModel, index) => {
      const openedGroup = this.openedGroups.get(viewModel.orderId);
      if (openedGroup) {
        const serverPosition = index + this.serverViewportStart;
        if (openedGroup.serverIndex !== serverPosition) {
          openedGroup.serverIndex = serverPosition;
        }
      }
    })
  };

  private sortTopLevelData = () => {
    const data = new IndexedMap<ViewModel>();

    // wee need to manually sort the incoming data
    const dataArr = this.topLevelData.getArray();
    dataArr.sort((a: ViewModel, b: ViewModel) => {
      return a.orderId.localeCompare(b.orderId, undefined, {numeric: true, sensitivity: 'base'})
    }).forEach(viewModel => {
      data.set(viewModel.orderId, viewModel);
    });

    this.topLevelData.replace(data);
  };

  /**
   * Takes the top level data and creates a flat structure that includes the children
   */
  private recalculateParsedData = () => {
    const data = new IndexedMap<ViewModel>();

    const dataArr = this.topLevelData.getArray();

    dataArr.forEach(viewModel => {
      data.set(viewModel.orderId, viewModel);
      if (viewModel.children.length) {
        viewModel.children.forEach(childViewModel => {
          data.set(childViewModel.orderId, childViewModel);
        });
      }
    });
    this.parsedData.replace(data);
  };

  /**
   * Sends request to the server to get the children for an order
   */
  public getChildren = (orderId: string) => {
    this.mockServer.getChildren(orderId);
    // if the group was not expanded before (so it was triggered by clicking the expand arrow)
    // we create a mock row with loading indicator
    const parent = this.topLevelData.get(orderId);
    if (parent && !this.openedGroups.has(orderId)) {
      const childrenViewModel = new ViewModel();
      childrenViewModel.isLoading = true;
      childrenViewModel.isChildren = true;
      childrenViewModel.orderId = '_mockLoading'; // it doesnt work if orderId has no value, ivestigate
      parent.children = observable.array([childrenViewModel]);
      this.onDataChanged();
    }
  };

  /**
   * Removes the children group from order
   */
  public removeChildren = (orderId: string) => {
    const order = this.topLevelData.get(orderId);
    if (order) {
      order.children = observable.array<ViewModel>([]);
    }

    // we delete the information about the opened group
    this.openedGroups.delete(orderId);

    // if closing the group would cause the grid viewport end row to exceed what we currently have
    // received from server, get the data again
    this.getDataIfNeeded();
    // propagating the data change
    this.onDataChanged();
  };

  private getDataIfNeeded = () => {
    if(this.getServerPositionFromGridPosition(this.gridViewportEnd) > this.serverViewportEnd) {
      const newServerViewportStart = this.getServerPositionFromGridPosition(this.gridViewportStart);
      this.getDataFromServer(newServerViewportStart, this.gridViewportEnd - this.gridViewportStart);
      // there's a strange behavior in ag-grid that it renders the old data instead of empty rows when it
      // doesn't have data provided for those rows, that's why we're adding mock view models so it'll correctly show
      // loading indicator
      for (let i=0; i<this.getServerPositionFromGridPosition(this.gridViewportEnd) - this.serverViewportEnd; i++) {
        const viewModel = new ViewModel({orderId: '_loading'});
        viewModel.isLoading = true;
        this.topLevelData.set('placeholder_' + i, viewModel);
      }
    }
  };

  /**
   * Handler for grid viewport range change
   */
  @action
  public setRange = (gridViewportStart: number, gridViewportEnd: number) => {
    this.gridViewportStart = gridViewportStart;
    this.gridViewportEnd = gridViewportEnd;

    const newServerViewportStart = this.getServerPositionFromGridPosition(gridViewportStart);
    const newServerViewportEnd = this.getServerPositionFromGridPosition(gridViewportEnd);

    // we should get the data from server either if it's the first request
    // or if either start or end are outside of data range we currently have
    const shouldGetDataFromServer = this.serverViewportStart === undefined
      || newServerViewportStart < this.serverViewportStart
      || newServerViewportEnd > this.serverViewportEnd;

    if (shouldGetDataFromServer) {
      this.getDataFromServer(newServerViewportStart, gridViewportEnd - gridViewportStart);
    } else {
      this.getDataFromCache();
    }
  };

  /**
   * Sends request to the server for the data
   */
  @action
  private getDataFromServer = debounce((offset: number, limit: number) => {
    console.log('PROVIDER: get data from server', {offset, limit});
    this.mockServer.getData({
      limit,
      offset
    });
  }, 500, {leading: true});

  /**
   * Retrieves the data from the cache
   */
  @action
  private getDataFromCache = () => {
    this.lastDataSouce = 'CACHE';
    this.dataChanged.next({data: this.parsedData.getArray(), startRow: this.serverViewportStart! + this.childrenAbove});
  };

  /**
   * Calculates the proper server index based on grid viewport index and opened groups information
   */
  private getServerPositionFromGridPosition = (gridViewPortPosition: number) => {
    let offset = 0;
    this.groupsSortedByIndex.forEach(value => {
      if (value.serverIndex < gridViewPortPosition - offset) {
        offset += Math.min(value.count, gridViewPortPosition - offset - value.serverIndex);
      }
    });

    return gridViewPortPosition - offset;
  };

  /**
   * DEBUG
   */

  @observable public lastDataSouce!: string;

  @computed
  public get virtualServerViewportStart() {
    return this.getServerPositionFromGridPosition(this.gridViewportStart);
  }

  @computed
  public get virtualServerViewportEnd() {
    return this.getServerPositionFromGridPosition(this.gridViewportEnd);
  }
}
