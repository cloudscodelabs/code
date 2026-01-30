import { useProjectStore } from '../../stores/project-store.js';
import { ProjectCard } from './ProjectCard.js';

export function ProjectList() {
  const projects = useProjectStore((s) => s.projects);

  if (projects.length === 0) {
    return (
      <div className="p-4 text-sm text-zinc-500 text-center">
        No projects yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
