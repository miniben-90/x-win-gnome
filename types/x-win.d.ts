export interface XWinIcon {
  data: string;
  width: number;
  height: number;
}

export interface XWinProcessInfo {
  path: string;
  exec_name: string;
  process_id: number;
  name: string;
}

export interface XWinPositionInfo {
  height: number;
  width: number;
  x: number;
  y: number;
  isFullScreen: boolean;
}

export interface XWinUsageInfo {
  memory: number;
}

export interface XWinWindowInfo {
  id: number;
  os: string;
  title: string;
  info: XWinProcessInfo;
  position: XWinPositionInfo;
  usage: XWinUsageInfo;
}
