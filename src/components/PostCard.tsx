import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarIcon, EyeIcon, HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import { getImageUrl } from '../utils/imageUtils';
import { Post } from '../services/posts.service';

interface PostCardProps {
  post: Post;
  liked?: boolean;
  onLike?: (postId: string, e: React.MouseEvent) => void;
  onClick?: (post: Post) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, liked, onLike, onClick }) => (
  <article
    onClick={onClick ? () => onClick(post) : undefined}
    className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer"
  >
    {post.thumbnail && (
      <img
        src={getImageUrl(post.thumbnail)}
        alt={post.title}
        className="w-full h-auto max-h-48 object-contain"
      />
    )}
    <div className="p-6">
      <span className="inline-block mb-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
        {post.section === 'ninos'
          ? 'Niños'
          : post.section === 'adultos'
          ? 'Adultos'
          : post.section === 'noticias'
          ? 'Noticias'
          : post.section && post.section.trim() !== ''
          ? post.section.charAt(0).toUpperCase() + post.section.slice(1)
          : 'Sin categoría'}
      </span>
      <div className="flex flex-wrap gap-2 mb-4">
        {post.tags
          ?.filter(
            (tag, idx, arr) =>
              tag.toLowerCase() !== (post.section?.toLowerCase() || '') &&
              arr.indexOf(tag) === idx
          )
          .map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            >
              {tag}
            </span>
          ))}
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2 hover:text-blue-600">
        {post.title}
      </h2>
      <p className="text-gray-600 mb-4">{post.excerpt}</p>
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <CalendarIcon className="h-4 w-4 mr-1" />
            {new Date(post.createdAt).toLocaleDateString()}
          </span>
          <span className="flex items-center">
            <EyeIcon className="h-4 w-4 mr-1" />
            {post.views || 0}
          </span>
          {onLike && (
            <button
              onClick={(e) => onLike(post.id, e)}
              className={`flex items-center transition-colors ${
                liked ? 'text-pink-600 hover:text-pink-700' : 'text-gray-500 hover:text-pink-600'
              }`}
            >
              {liked ? (
                <HeartSolidIcon className="h-4 w-4 mr-1" />
              ) : (
                <HeartIcon className="h-4 w-4 mr-1" />
              )}
              {post.likes || 0}
            </button>
          )}
        </div>
        <span>{post.readTime || '1 min'}</span>
      </div>
    </div>
  </article>
);

export default PostCard; 