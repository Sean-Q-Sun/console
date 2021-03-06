import * as _ from 'lodash-es';
import * as React from 'react';

import { ColHead, DetailsPage, List, ListHeader, ListPage, ResourceRow } from './factory';
import { Cog, ResourceCog, detailsPage, navFactory, ResourceLink, ResourceSummary } from './utils';
import { registerTemplate } from '../yaml-templates';
// eslint-disable-next-line no-unused-vars
import {K8sResourceKind, K8sResourceKindReference} from '../module/k8s';

const RoutesReference: K8sResourceKindReference = 'Route';
const menuActions = Cog.factory.common;

registerTemplate('route.openshift.io/v1.Route', `apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: example
spec:
  path: /
  to:
    kind: Service
    name: example
  port:
    targetPort: 80`);

const getRouteHost = (route, onlyAdmitted) => {
  let oldestAdmittedIngress = null;
  _.each(route.status.ingress, (ingress) => {
    if (_.some(ingress.conditions, { type: 'Admitted', status: 'True' }) &&
      (!oldestAdmittedIngress || oldestAdmittedIngress.lastTransitionTime > ingress.lastTransitionTime)) {
      oldestAdmittedIngress = ingress;
    }
  });

  if (oldestAdmittedIngress) {
    return oldestAdmittedIngress.host;
  }

  return onlyAdmitted ? null : route.spec.host;
};

const isWebRoute = (route) => {
  return !!getRouteHost(route, true) &&
    _.get(route, 'spec.wildcardPolicy') !== 'Subdomain';
};

const getRouteWebURL = (route) => {
  const scheme = _.get(route, 'spec.tls.termination') ? 'https' : 'http';
  let url = `${scheme }://${getRouteHost(route, false)}`;
  if (route.spec.path) {
    url += route.spec.path;
  }
  return url;
};

const getSubdomain = (route) => {
  let hostname = _.get(route, 'spec.host', '');
  return hostname.replace(/^[a-z0-9]([-a-z0-9]*[a-z0-9])\./, '');
};

const getRouteLabel = (route) => {
  if (isWebRoute(route)) {
    return getRouteWebURL(route);
  }

  let label = getRouteHost(route, false);
  if (!label) {
    return '<unknown host>';
  }

  if (_.get(route, 'spec.wildcardPolicy') === 'Subdomain') {
    label = `*.${ getSubdomain(route)}`;
  }

  if (route.spec.path) {
    label += route.spec.path;
  }
  return label;
};

export const RouteLocation: React.SFC<RouteHostnameProps> = ({obj}) => <div>
  {isWebRoute(obj) ? <a href={getRouteWebURL(obj)} target="_blank" rel="noopener noreferrer">
    {getRouteLabel(obj)}&nbsp;<i className="fa fa-external-link" aria-hidden="true"/>
  </a> : getRouteLabel(obj)
  }
</div>;
RouteLocation.displayName = 'RouteLocation';

export const RouteStatus: React.SFC<RouteHostnameProps> = ({obj: route}) => {
  let atLeastOneAdmitted: boolean = false;

  if (!route.status || !route.status.ingress) {
    return <span>
      <div className="fa fa-hourglass-half co-m-route-status-icon" aria-hidden="true"></div>
      Pending
    </span>;
  }

  _.each(route.status.ingress, (ingress) => {
    const isAdmitted = _.some(ingress.conditions, {type: 'Admitted', status: 'True'});
    if (isAdmitted) {
      atLeastOneAdmitted = true;
    }
  });

  return atLeastOneAdmitted
    ? <span>
      <div className="fa fa-check text-success co-m-route-status-icon" aria-hidden="true"></div>
      Accepted
    </span>
    : <span>
      <div className="fa fa-times text-danger co-m-route-status-icon" aria-hidden="true"></div>
      Rejected
    </span>;
};
RouteStatus.displayName = 'RouteStatus';

const addTLSWarnings = (route: any, warnings: string[]) => {
  if (!route.spec || !route.spec.tls) {
    return;
  }

  if (!route.spec.tls.termination) {
    warnings.push('Route has a TLS configuration, but no TLS termination type is specified. TLS will not be enabled until a termination type is set.');
  }

  if (route.spec.tls.termination === 'passthrough' && route.spec.path) {
    warnings.push(`Route path "${ route.spec.path }" will be ignored since the route uses passthrough termination.`);
  }
};

const addIngressWarnings = (route: any, warnings: string[]) => {
  if (!route.status) {
    return;
  }

  _.each(route.status.ingress, (ingress) => {
    const condition: any = _.find(ingress.conditions, { type: 'Admitted', status: 'False' });
    if (condition) {
      let message = `Requested host '${ ingress.host || '<unknown host>' }' was rejected by the router.`;
      if (condition.message || condition.reason) {
        message += ` Reason: ${ condition.message || condition.reason }.`;
      }
      warnings.push(message);
    }
  });
};

export const RouteWarnings: React.SFC<RouteHostnameProps> = ({obj: route}) => {
  const warnings: string[] = [];

  if (!route) {
    return;
  }

  addTLSWarnings(route, warnings);
  addIngressWarnings(route, warnings);
  return <React.Fragment>
    {warnings.map((warning, index) => <div key={index} className="co-m-route-warnings">{warning}</div>)}
  </React.Fragment>;
};
RouteWarnings.displayName = 'RouteWarnings';

const RouteListHeader: React.SFC<RouteHeaderProps> = props => <ListHeader>
  <ColHead {...props} className="col-md-3 col-sm-4 col-xs-6" sortField="metadata.name">Name</ColHead>
  <ColHead {...props} className="col-md-3 col-sm-4 col-xs-6" sortField="spec.host">Location</ColHead>
  <ColHead {...props} className="col-md-2 col-sm-4 hidden-xs" sortField="spec.to.name">Service</ColHead>
  <ColHead {...props} className="col-md-4 hidden-sm hidden-xs">Status</ColHead>
</ListHeader>;

const RouteListRow: React.SFC<RoutesRowProps> = ({obj: route}) => <ResourceRow obj={route}>
  <div className="col-md-3 col-sm-4 col-xs-6">
    <ResourceCog actions={menuActions} kind="Route" resource={route} />
    <ResourceLink kind="Route" name={route.metadata.name}
      namespace={route.metadata.namespace} title={route.metadata.uid} />
  </div>
  <div className="col-md-3 col-sm-4 col-xs-6">
    <RouteLocation obj={route} />
  </div>
  <div className="col-md-2 col-sm-4 hidden-xs">
    <ResourceLink kind="Service" name={route.spec.to.name} namespace={route.metadata.namespace} title={route.spec.to.name} />
  </div>
  <div className="col-md-4 hidden-sm hidden-xs"><RouteStatus obj={route} /></div>
</ResourceRow>;

const TLSSettings = props => <span>
  {!props.tls && 'TLS is not enabled.'}
  {props.tls && <dl>
    <dt>Termination Type</dt>
    <dd>{props.tls.termination}</dd>
    <dt>Insecure Traffic</dt>
    <dd>{props.tls.insecureEdgeTerminationPolicy || '-'}</dd>
    <dt>Certificate</dt>
    <dd>{props.tls.certificate || '-'}</dd>
    <dt>Key</dt>
    <dd>{props.tls.key || '-'}</dd>
    <dt>CA Certificate</dt>
    <dd>{props.tls.caCertificate || '-'}</dd>
    {_.get(props.tls, 'termination') === 'reencrypt' && <span>
      <dt>Destination CA Cert</dt>
      <dd>{props.tls.destinationCACertificate || '-'}</dd>
    </span>}
  </dl>
  }
</span>;

const RouteDetails: React.SFC<RoutesDetailsProps> = ({obj: route}) => <React.Fragment>
  <div className="co-m-pane__body">
    <div className="row">
      <div className="col-sm-6">
        <ResourceSummary resource={route} showPodSelector={false} showNodeSelector={false}>
          <dt>{route.spec.to.kind}</dt>
          <dd><ResourceLink kind={route.spec.to.kind} name={route.spec.to.name} namespace={route.metadata.namespace}
            title={route.spec.to.name} />
          </dd>
          <dt>Target Port</dt>
          <dd>{_.get(route, 'spec.port.targetPort', '-')}</dd>
        </ResourceSummary>
      </div>
      <div className="col-sm-6">
        <dt>Location</dt>
        <dd><RouteLocation obj={route} /></dd>
        <dt>Status</dt>
        <dd>
          <RouteStatus obj={route} />
          <RouteWarnings obj={route} />
        </dd>
        <dt>Hostname</dt>
        <dd>{route.spec.host}</dd>
        <dt>Path</dt>
        <dd>{route.spec.path || '-'}</dd>
      </div>
    </div>
  </div>
  <div className="co-m-pane__body">
    <h1 className="co-section-title">TLS Settings</h1>
    <TLSSettings tls={route.spec.tls} />
  </div>
</React.Fragment>;

export const RoutesDetailsPage: React.SFC<RoutesDetailsPageProps> = props => <DetailsPage
  {...props}
  kind={RoutesReference}
  menuActions={menuActions}
  pages={[navFactory.details(detailsPage(RouteDetails)), navFactory.editYaml()]}
/>;
export const RoutesList: React.SFC = props => <List {...props} Header={RouteListHeader} Row={RouteListRow} />;
export const RoutesPage: React.SFC<RoutesPageProps> = props =>
  <ListPage
    ListComponent={RoutesList}
    kind={RoutesReference}
    canCreate={true}
    {...props}
  />;

/* eslint-disable no-undef */
export type RouteHostnameProps = {
  obj: K8sResourceKind
};

export type RoutesRowProps = {
  obj: K8sResourceKind
};

export type RouteHeaderProps = {
  obj: K8sResourceKind
};

export type RoutesPageProps = {
  obj: K8sResourceKind
};

export type RoutesDetailsProps = {
  obj: K8sResourceKind
};

export type RoutesDetailsPageProps = {
  match: any
};
/* eslint-enable no-undef */
