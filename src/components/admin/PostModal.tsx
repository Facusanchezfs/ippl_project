import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Post, CreatePostDTO } from '../../services/posts.service';

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (post: FormData) => Promise<void>;
  post?: Post;
}

const PostModal: React.FC<PostModalProps> = ({ isOpen, onClose, onSave, post }) => {
  const [formData, setFormData] = useState<CreatePostDTO>({
    title: '',
    content: '',
    section: 'bienestar'
  });

  useEffect(() => {
    if (post) {
      setFormData({
        title: post.title,
        content: post.content,
        section: post.section
      });
    } else {
      setFormData({
        title: '',
        content: '',
        section: 'bienestar'
      });
    }
  }, [post]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const data = new FormData();

        data.append("title", formData.title ?? "");
        data.append("content", formData.content ?? "");
        data.append("section", formData.section ?? "");
        data.append("excerpt", formData.excerpt ?? "");
        data.append("status", formData.status ?? "draft");
        data.append("featured", String(formData.featured ?? false));

        data.append("tags", JSON.stringify(formData.tags ?? []));
        data.append("seo", JSON.stringify(formData.seo ?? {}));

        data.append("author", String(formData.author ?? ""));
        data.append("authorName", formData.authorName ?? "");
        data.append("slug", formData.slug ?? "");
        data.append("readTime", formData.readTime ?? "1 min");

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        if (formData.thumbnail instanceof File) {
            data.append("thumbnail", formData.thumbnail);
        }

        await onSave(data);
        onClose();
    };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-lg bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-900">
            {post ? 'Editar Artículo' : 'Nuevo Artículo'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Título
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>

          <div>
            <label htmlFor="section" className="block text-sm font-medium text-gray-700">
              Sección
            </label>
            <select
              id="section"
              name="section"
              value={formData.section}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="bienestar">Bienestar</option>
              <option value="salud-mental">Salud Mental</option>
              <option value="psicologia">Psicología</option>
            </select>
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700">
              Contenido
            </label>
            <textarea
              id="content"
              name="content"
              value={formData.content}
              onChange={handleChange}
              required
              rows={10}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              {post ? 'Guardar Cambios' : 'Crear Artículo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostModal; 