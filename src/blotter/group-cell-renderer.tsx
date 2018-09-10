import * as React from 'react';
import { reaction, IReactionDisposer, computed } from 'mobx';
import {observer} from 'mobx-react';
import {ICellRendererParams} from 'ag-grid';
import { ViewModel } from './view-model';

export interface IgroupCellRendererProps extends ICellRendererParams {
  isGroup: (data: any) => boolean;
  isExpanded: (data: any) => boolean;
  onExpandCollapseChange: (data: any, expanded: boolean) => void;
}

@observer
export class GroupCellRenderer extends React.Component<IgroupCellRendererProps> {
  @computed
  private get viewModel(): ViewModel {
    return this.props.node.data as ViewModel;
  }

  @computed
  private get isGroup() {
    return this.viewModel && this.viewModel.isGroup;
  }

  @computed
  private get isExpanded() {
    return this.viewModel && this.viewModel.isExpanded;
  }

  @computed
  private get isLoading() {
    return this.viewModel && this.viewModel.isLoading;
  }

  private onExpandCollapseClick = () => {
    this.props.onExpandCollapseChange(this.props.node.data, !this.isExpanded);
  }

  private renderExpandCollapse = () => {
    return (
      <span onClick={this.onExpandCollapseClick} style={{display: "inline-block", width: "10px"}}>
        {this.isExpanded ? 'v ' : '> '}
      </span>
    )
  }

  private renderValue = () => {
    const padding = this.isGroup ? 0 : '10px';
    return <span style={{display: "inline-block", paddingLeft: padding}}>{this.isLoading ? this.renderLoading() : this.props.value}</span>
  }

  private renderLoading = () => {
    return '...'
  }


  render() {
    const padding = this.viewModel && this.viewModel.isChildren ? "20px" : 0;

    return (
      !this.viewModel ? this.renderLoading() : <div style={{paddingLeft: padding}}>{this.isGroup && this.renderExpandCollapse()}{this.renderValue()}</div>
    )
  }
}