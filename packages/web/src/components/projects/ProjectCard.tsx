import type { ProjectListItem } from '@cloudscode/shared';
import { wsClient } from '../../lib/ws-client.js';
import { useProjectStore } from '../../stores/project-store.js';

interface ProjectCardProps {
  project: ProjectListItem;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const isActive = activeProject?.id === project.id;

  const handleClick = () => {
    wsClient.send({
      type: 'project:resume',
      payload: { projectId: project.id },
    });
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left px-3 py-2 rounded transition-colors ${
        isActive ? 'bg-zinc-800' : 'hover:bg-zinc-850'
      }`}
    >
      <div className="text-sm text-zinc-300 truncate">
        {project.title ?? `Project ${project.id.slice(0, 8)}`}
      </div>
      <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-600">
        <span>{project.status}</span>
        {project.totalCostUsd > 0 && <span>${project.totalCostUsd.toFixed(4)}</span>}
      </div>
    </button>
  );
}
